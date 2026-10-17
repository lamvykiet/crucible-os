import { SchemaType, type Schema, type Part } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { GEMINI_VISION_MODEL, GEMINI_VISION_CHAIN, modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry } from "@/lib/aiRetry";
import { PAYMENT_METHODS, toVnd } from "@/lib/invoice";

/**
 * Bot đọc tin nhắn chữ / tin thoại thành giao dịch NHÁP.
 *
 * Gemini chỉ đề xuất; mọi thứ nó trả về đều đi qua `sanitize` — nhóm phải có
 * thật trong danh mục, thẻ phải là thẻ của người dùng, số tiền phải là số
 * nguyên dương. Đọc không ra thì để trống, đúng nguyên tắc của luồng OCR:
 * ô trống người dùng còn thấy mà sửa, con số bịa thì không.
 */

export interface BotContext {
  /** Nhóm chi tiêu / thu nhập: tên chuẩn → nhãn Việt + nhóm phụ. */
  expense: Map<string, { vi: string | null; subs: Map<string, string | null> }>;
  income: Map<string, { vi: string | null; subs: Map<string, string | null> }>;
  accounts: Array<{ id: string; name: string; kind: string; bank: string | null; last4: string | null }>;
}

export interface ParsedTx {
  type: "Expense" | "Income" | "Refund";
  date: string | null;
  supplier: string | null;
  totalAmount: number | null;
  categoryGroup: string | null;
  subGroup: string | null;
  paymentMethod: string;
  accountId: string | null;
  notes: string | null;
  items: Array<{ productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
}

export async function loadBotContext(userId: string): Promise<BotContext> {
  const [cats, accounts] = await Promise.all([
    prisma.category.findMany({
      where: { userId, active: true, kind: { in: ["expense_group", "income_group"] } },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { userId, status: "active" },
      select: { id: true, name: true, kind: true, bank: true, last4: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const tree = (kind: string) => {
    const map: BotContext["expense"] = new Map();
    const parents = cats.filter((c) => c.kind === kind && !c.parentId);
    for (const p of parents) {
      map.set(p.name, {
        vi: p.nameVi,
        subs: new Map(cats.filter((c) => c.parentId === p.id).map((c) => [c.name, c.nameVi])),
      });
    }
    return map;
  };
  return { expense: tree("expense_group"), income: tree("income_group"), accounts };
}

/** Bản nháp đang có, đưa cho Gemini khi người dùng nhắn sửa. */
export type CurrentDraft = Omit<ParsedTx, "type"> & { type: string };

const ITEM: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    productName: { type: SchemaType.STRING },
    quantity: { type: SchemaType.NUMBER },
    unitPrice: { type: SchemaType.NUMBER },
    totalPrice: { type: SchemaType.NUMBER },
  },
  required: ["productName", "quantity", "unitPrice", "totalPrice"],
};

const TX: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    type: { type: SchemaType.STRING, format: "enum", enum: ["Expense", "Income", "Refund"] },
    date: { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
    supplier: { type: SchemaType.STRING, nullable: true },
    totalAmount: { type: SchemaType.NUMBER, nullable: true, description: "Integer VND" },
    categoryGroup: { type: SchemaType.STRING, nullable: true },
    subGroup: { type: SchemaType.STRING, nullable: true },
    paymentMethod: { type: SchemaType.STRING, format: "enum", enum: [...PAYMENT_METHODS] },
    accountId: { type: SchemaType.STRING, nullable: true },
    accountMention: {
      type: SchemaType.STRING,
      nullable: true,
      description: "The exact words the user used to name the card/account (e.g. 'thẻ Timo', 'UOB'); null if none",
    },
    notes: { type: SchemaType.STRING, nullable: true },
    items: { type: SchemaType.ARRAY, items: ITEM },
  },
  required: [
    "type", "date", "supplier", "totalAmount", "categoryGroup", "subGroup",
    "paymentMethod", "accountId", "accountMention", "notes", "items",
  ],
};

const SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    transactions: { type: SchemaType.ARRAY, items: TX },
    reply: {
      type: SchemaType.STRING,
      nullable: true,
      description: "Only when the message records NO money movement: a short Vietnamese reply",
    },
  },
  required: ["transactions", "reply"],
};

const FIELDS = [
  "type", "date", "supplier", "totalAmount", "categoryGroup", "subGroup",
  "paymentMethod", "accountId", "notes", "items",
] as const;

/**
 * Lần sửa chỉ trả về TRƯỜNG ĐỔI cùng danh sách tên của chúng; gộp vào bản nháp
 * là việc của code. Đo 18/10: bắt Gemini chép lại cả bản nháp thì nó trả đúng
 * số tiền mới nhưng để trống nhà cung cấp, nhóm và thẻ.
 */
const PATCH_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    changed: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING, format: "enum", enum: [...FIELDS] },
      description: "Names of the fields the user asked to change — nothing else",
    },
    patch: { ...TX, required: [] },
    reply: {
      type: SchemaType.STRING,
      nullable: true,
      description: "Only when the message is not a correction: a short Vietnamese reply",
    },
  },
  required: ["changed", "patch", "reply"],
};

/** Ngày hôm nay theo giờ Việt Nam, YYYY-MM-DD. Máy chủ Vercel chạy giờ UTC. */
export function todayVn(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
export const weekdayVi = (iso: string) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

function describeContext(ctx: BotContext): string {
  const tree = (m: BotContext["expense"]) =>
    [...m]
      .map(([g, v]) => {
        const subs = [...v.subs].map(([s, vi]) => (vi && vi !== s ? `${s} (${vi})` : s)).join(", ");
        return `- ${g}${v.vi && v.vi !== g ? ` (${v.vi})` : ""}${subs ? `: ${subs}` : ""}`;
      })
      .join("\n");
  const accounts = ctx.accounts
    .map((a) => `- id=${a.id} | ${a.name} | ${a.kind}${a.bank ? ` | ${a.bank}` : ""}${a.last4 ? ` | ••${a.last4}` : ""}`)
    .join("\n");
  return `EXPENSE categories (group: sub-groups), use the English names exactly:\n${tree(ctx.expense)}\n\nINCOME categories:\n${tree(ctx.income)}\n\nACCOUNTS:\n${accounts || "(none)"}`;
}

const RULES = `Rules:
- Currency is VND; every amount is an INTEGER. Vietnamese shorthand: "45k" or "45 nghìn/ngàn" = 45000; "1tr2", "1 triệu 2", "1,2tr" = 1200000; "2 lít" is NOT money; "củ" = triệu (million).
- If no amount is stated, totalAmount is null. Never guess an amount.
- date is YYYY-MM-DD. If no day is mentioned, use TODAY. Resolve relative days ("hôm qua", "tối qua", "thứ 2 tuần trước", "sáng nay") against TODAY.
- One message may record SEVERAL purchases ("sáng cafe 30k, trưa cơm 50k") → one transaction each.
- categoryGroup / subGroup: pick ONLY from the lists, using the English name exactly; null if nothing fits. Any spending during a trip or holiday ("du lịch", "chuyến đi", a resort, a hotel away from home) goes to group "Travel", with the Travel sub-group that matches what was bought (meals and coffee → "Travel Food", hotel → "Accommodation", fuel/tickets/taxi → "Travel Transport"), and notes starting with "Du lịch <Place> <MM/YYYY>" when the place is known.
- paymentMethod: "thẻ / quẹt thẻ / visa" = card; "tiền mặt" = cash; "chuyển khoản / ck" = bank_transfer; "momo / zalopay / ví" = e-wallet; otherwise unknown.
- accountId: only when the user names a specific card or account (bank name, card name, last 4 digits) that matches ACCOUNTS; otherwise null.
- supplier: the shop or place ("Petrolimex", "Highlands"); if none is named, a 2–4 word Vietnamese description ("Gửi xe", "Chợ").
- items: only when the user lists individual things with prices; otherwise [].
- notes: extra context worth keeping (trip name, who it was for), Vietnamese, else null.
- Income = money received (lương, được trả, hoàn tiền là Refund).
- If the message is not about money (greeting, question), return transactions [] and a short Vietnamese reply.`;

export interface BotInput {
  text?: string;
  audio?: { data: Buffer; mimeType: string };
}

function inputParts(input: BotInput): Array<string | Part> {
  const parts: Array<string | Part> = [];
  if (input.audio) {
    parts.push({ inlineData: { data: input.audio.data.toString("base64"), mimeType: input.audio.mimeType } });
    parts.push("The audio above is a Vietnamese voice message from the user.");
  }
  if (input.text) parts.push(`User message: """${input.text}"""`);
  return parts;
}

async function callGemini<T>(prompt: string, input: BotInput, schema: Schema = SCHEMA): Promise<T> {
  const models = modelsWithFallback(
    // Nhiệt độ 0: cùng một câu thì cùng một kết quả — đây là việc trích dữ liệu,
    // không phải viết văn.
    { generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 } },
    GEMINI_VISION_MODEL,
    GEMINI_VISION_CHAIN
  );
  // Một tin nhắn ngắn: model nhanh trả lời trong vài giây. Tin thoại dài hơn
  // chút. Ngân sách để còn chỗ nhảy model khi model đầu quá tải.
  const result = await generateWithRetry(models, [prompt, ...inputParts(input)], {
    timeoutMs: 30_000,
    totalBudgetMs: 60_000,
  });
  return JSON.parse(result.response.text()) as T;
}

export async function parseMessage(
  ctx: BotContext,
  input: BotInput
): Promise<{ transactions: ParsedTx[]; reply: string | null }> {
  const today = todayVn();
  const prompt = `You turn a Vietnamese user's message about spending or income into transactions for their personal finance ledger.

TODAY is ${today} (${weekdayVi(today)}), Vietnam time.

${describeContext(ctx)}

${RULES}`;
  const raw = await callGemini<{ transactions: unknown[]; reply: string | null }>(prompt, input);
  return {
    transactions: (raw.transactions ?? []).map((t) => sanitize(t, ctx, today, input.audio ? undefined : input.text)),
    reply: raw.reply || null,
  };
}

/** Người dùng trả lời một bản nháp để sửa: chỉ đổi đúng những trường họ nói. */
export async function applyCorrection(ctx: BotContext, current: CurrentDraft, input: BotInput): Promise<ParsedTx> {
  const today = todayVn();
  const prompt = `The user is correcting a draft transaction in their personal finance ledger. Work out which fields they want to change and return ONLY those: list their names in "changed" and their new values in "patch". Fields they did not mention must not appear in "changed". Changing the category group means also changing subGroup to the best match inside the new group (list both in "changed"); moving something to Travel also sets notes as the rules say.

Example: draft {supplier "Phở Hùng", categoryGroup "Food & Dining", subGroup "Lunch", date "2026-07-14"}, user says "khoản này của chuyến Nha Trang" → changed ["categoryGroup", "subGroup", "notes"], patch {categoryGroup "Travel", subGroup "Travel Food", notes "Du lịch Nha Trang 07/2026"}.

TODAY is ${today} (${weekdayVi(today)}), Vietnam time.

CURRENT DRAFT:
${JSON.stringify(current, null, 2)}

${describeContext(ctx)}

${RULES}`;
  const raw = await callGemini<{ changed?: string[]; patch?: Record<string, unknown>; reply?: string | null }>(
    prompt,
    input,
    PATCH_SCHEMA
  );
  const changed = (raw.changed ?? []).filter((f): f is (typeof FIELDS)[number] => FIELDS.includes(f as never));
  if (changed.length === 0) throw new Error(raw.reply || "Không hiểu cần sửa gì");

  const merged: Record<string, unknown> = { ...current };
  // Gemini có lúc kê tên trường vào "changed" mà quên đưa giá trị: thiếu thì
  // giữ giá trị cũ, chỉ `null` tường minh mới là xoá.
  for (const f of changed) if (raw.patch && f in raw.patch) merged[f] = raw.patch[f];
  // Thẻ chỉ được đổi khi lần sửa này gọi tên nó; thẻ cũ thì đã qua kiểm rồi.
  if (changed.includes("accountId")) merged.accountMention = raw.patch?.accountMention ?? null;
  else merged.accountMention = KEEP_ACCOUNT;
  // Đổi nhóm mà không nói nhóm phụ: nhóm phụ cũ thuộc nhóm cũ, sanitize sẽ bỏ.
  return sanitize(merged, ctx, current.date ?? today, input.audio ? undefined : input.text);
}

/** Đánh dấu "thẻ giữ nguyên từ bản nháp" — khỏi kiểm lại chữ người dùng nói. */
const KEEP_ACCOUNT = "\u0000keep";

const fold = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

/**
 * Gemini có gọi đúng tên thẻ người dùng nói không? Đo 18/10: tin thoại "đổ xăng
 * 500 nghìn quẹt thẻ" — không nói thẻ nào — mà Gemini vẫn gán thẻ Timo. Gán
 * nhầm thẻ là dư nợ thẻ sai mà không gì báo, nên chỉ nhận khi chữ người dùng
 * nói có chứa tên thẻ, tên ngân hàng hoặc 4 số cuối.
 */
function accountNamed(mention: unknown, a: BotContext["accounts"][number]): boolean {
  if (mention === KEEP_ACCOUNT) return true;
  if (typeof mention !== "string" || !mention.trim()) return false;
  const said = fold(mention);
  if (a.last4 && said.includes(a.last4)) return true;
  const words = fold(`${a.name} ${a.bank ?? ""}`)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !["the", "card", "visa", "mastercard", "credit", "bank"].includes(w));
  // So trên chuỗi đã bỏ khoảng trắng: người dùng nói "VP Bank", tên thẻ ghi "VPBank".
  const compact = said.replace(/[^a-z0-9]/g, "");
  return words.some((w) => compact.includes(w));
}

const isIsoDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const METHOD_BY_KIND: Record<string, string> = {
  credit_card: "card",
  bank: "bank_transfer",
  cash: "cash",
  ewallet: "e-wallet",
};

/**
 * `said`: nguyên văn chữ người dùng gõ, nếu có. Khi có thì tên thẻ phải nằm
 * trong CHÍNH câu đó — không chỉ trong lời Gemini thuật lại. Tin thoại thì
 * không có nguyên văn, đành dựa vào `accountMention`; bản tóm tắt gửi lại hiện
 * rõ tên thẻ để người dùng thấy trước khi bấm ✅.
 */
export function sanitize(input: unknown, ctx: BotContext, today: string, said?: string): ParsedTx {
  const t = (input ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const type = t.type === "Income" || t.type === "Refund" ? t.type : "Expense";

  // Income dùng nhóm thu nhập, còn lại dùng nhóm chi tiêu — cùng quy ước với
  // `useCategories`.
  const tree = type === "Income" ? ctx.income : ctx.expense;
  let categoryGroup = s(t.categoryGroup);
  if (categoryGroup && !tree.has(categoryGroup)) categoryGroup = null;
  let subGroup = s(t.subGroup);
  if (subGroup && !(categoryGroup && tree.get(categoryGroup)!.subs.has(subGroup))) subGroup = null;

  const picked = ctx.accounts.find((a) => a.id === t.accountId) ?? null;
  const account =
    picked &&
    accountNamed(t.accountMention, picked) &&
    (t.accountMention === KEEP_ACCOUNT || !said || accountNamed(said, picked))
      ? picked
      : null;
  let paymentMethod = PAYMENT_METHODS.includes(t.paymentMethod as never) ? String(t.paymentMethod) : "unknown";
  if (account && paymentMethod === "unknown") paymentMethod = METHOD_BY_KIND[account.kind] ?? "unknown";

  const amount = toVnd(t.totalAmount);
  const items = Array.isArray(t.items)
    ? (t.items as Array<Record<string, unknown>>)
        .map((i) => ({
          productName: s(i.productName) ?? "",
          quantity: Number(i.quantity) || 1,
          unitPrice: toVnd(i.unitPrice) ?? 0,
          totalPrice: toVnd(i.totalPrice) ?? 0,
        }))
        .filter((i) => i.productName)
    : [];

  return {
    type,
    date: isIsoDate(t.date) ? t.date : today,
    supplier: s(t.supplier),
    totalAmount: amount !== null && amount > 0 ? amount : null,
    categoryGroup,
    subGroup,
    paymentMethod,
    accountId: account?.id ?? null,
    notes: s(t.notes),
    items,
  };
}
