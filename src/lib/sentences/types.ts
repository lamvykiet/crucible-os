/**
 * Kho câu cho hai màn Gõ câu và Dịch câu.
 *
 * Một câu mang đủ thứ cho cả hai màn: câu tiếng Anh, nghĩa tiếng Việt, câu cắt
 * thành cụm (để gõ dần từ → cụm → cả câu) và vài từ khoá (bậc thấp nhất).
 *
 * Ý tưởng học từ hai trang luyentu.com và aioenglish.com, nhưng câu là tự soạn —
 * không chép câu của họ (xem ranh giới bản quyền đã chốt cho Learning).
 */

export interface SentencePiece {
  en: string;
  vi: string;
}

export interface Sentence {
  en: string;
  vi: string;
  /** Câu cắt thành cụm theo đúng thứ tự; nối lại phải ra nguyên câu. */
  chunks: SentencePiece[];
  /** Từ/cụm từ khoá xuất hiện liền mạch trong câu. Có thể trống. */
  keys: SentencePiece[];
}

export interface SentenceSet {
  /** Định danh bền. Đừng đổi sau khi phát hành: tiến độ lưu theo id này. */
  id: string;
  title: string;
  level: string;
  topic: string;
  note: string;
  sentences: Sentence[];
}

/* ── So khớp ─────────────────────────────────────────────────────────────── */

/** Tách câu thành các chữ để hiện (giữ dấu câu dính theo chữ). */
export const displayTokens = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Chuẩn hoá MỘT chữ để so: thường hoá, bỏ dấu câu hai đầu, thống nhất dấu nháy. */
export function normWord(w: string) {
  return w
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "")
    .replace(/^'+|'+$/g, "");
}

/**
 * Bung dạng viết tắt để "I've" và "I have" được tính là một.
 *
 * Không bung "'s": nó có thể là "is", "has" hay sở hữu cách — đoán sai còn tệ
 * hơn không đoán. "'d" bung thành "would" vì trong kho câu nó luôn là would.
 */
function expand(words: string[]) {
  const out: string[] = [];
  for (const w of words) {
    if (w === "won't") out.push("will", "not");
    else if (w === "can't" || w === "cannot") out.push("can", "not");
    else if (w === "shan't") out.push("shall", "not");
    else if (w.endsWith("n't")) out.push(w.slice(0, -3), "not");
    else if (w.endsWith("'re")) out.push(w.slice(0, -3), "are");
    else if (w.endsWith("'ve")) out.push(w.slice(0, -3), "have");
    else if (w.endsWith("'ll")) out.push(w.slice(0, -3), "will");
    else if (w.endsWith("'m")) out.push(w.slice(0, -2), "am");
    else if (w.endsWith("'d")) out.push(w.slice(0, -2), "would");
    else if (w === "let's") out.push("let", "us");
    else out.push(w);
  }
  return out.filter(Boolean);
}

const wordsOf = (s: string) => displayTokens(s).map(normWord).filter(Boolean);

/** Hai câu có giống nhau không, bỏ qua hoa thường, dấu câu và dạng viết tắt. */
export function sameSentence(a: string, b: string) {
  const x = expand(wordsOf(a));
  const y = expand(wordsOf(b));
  return x.length === y.length && x.every((w, i) => w === y[i]);
}

/**
 * Đã gõ đúng bao nhiêu chữ đầu câu — để lật dần các ô che chữ.
 *
 * Chữ đang gõ dở (chưa có dấu cách sau) chỉ được tính khi đã khớp trọn, để gõ
 * "a" không lật mất ô "about".
 */
export function revealedCount(input: string, reference: string) {
  const ref = displayTokens(reference).map(normWord);
  const typed = input.split(/\s+/);
  const endsWithSpace = /\s$/.test(input);
  const done = endsWithSpace ? typed.filter(Boolean) : typed;

  let n = 0;
  while (n < done.length && n < ref.length) {
    const w = normWord(done[n]);
    if (!w || w !== ref[n]) break;
    n++;
  }
  return n;
}

/**
 * Gợi ý thêm một chữ: giữ phần đã đúng, thay phần gõ dở bằng chữ kế tiếp.
 * Trả về chuỗi mới cho ô nhập.
 */
export function hintNext(input: string, reference: string) {
  const ref = displayTokens(reference);
  const n = revealedCount(input, reference);
  if (n >= ref.length) return input;
  const kept = input.split(/\s+/).filter(Boolean).slice(0, n);
  // Bỏ dấu câu ở chữ gợi ý cho đỡ rối, trừ khi là chữ cuối.
  const next = n === ref.length - 1 ? ref[n] : ref[n].replace(/[.,!?;:]+$/, "");
  return [...kept, next].join(" ") + (n === ref.length - 1 ? "" : " ");
}

/** Chấm theo từng chữ để tô đúng/sai khi nộp. */
export function markWords(input: string, reference: string) {
  const ref = displayTokens(reference);
  const got = wordsOf(input);
  return ref.map((word, i) => ({ word, ok: normWord(word) === (got[i] ?? "") }));
}

/**
 * Các bậc của một câu trong màn Gõ câu.
 *
 * - basic: từ khoá → từng cụm → cả câu (giống bậc "Cơ bản" của AIO).
 * - medium: từ khoá → cả câu.
 * - hard: chỉ cả câu.
 */
export type TypingLevel = "basic" | "medium" | "hard";

export interface TypingStep {
  kind: "key" | "chunk" | "sentence";
  en: string;
  vi: string;
}

export function typingSteps(s: Sentence, level: TypingLevel): TypingStep[] {
  const steps: TypingStep[] = [];
  if (level !== "hard") for (const k of s.keys) steps.push({ kind: "key", ...k });
  if (level === "basic" && s.chunks.length > 1) for (const c of s.chunks) steps.push({ kind: "chunk", ...c });
  steps.push({ kind: "sentence", en: s.en, vi: s.vi });
  return steps;
}

/**
 * Soát một câu (viết sẵn hay AI trả về): cụm nối lại phải ra nguyên câu, từ
 * khoá phải nằm liền mạch trong câu. Trả về danh sách lỗi; rỗng là hợp lệ.
 */
export function validateSentence(s: Sentence): string[] {
  const errors: string[] = [];
  if (!s.en?.trim() || !s.vi?.trim()) errors.push("thiếu câu hoặc nghĩa");
  const whole = wordsOf(s.en).join(" ");
  const joined = s.chunks.map((c) => wordsOf(c.en).join(" ")).join(" ");
  if (s.chunks.length > 0 && joined !== whole) errors.push(`cụm không ghép lại ra câu: "${s.en}"`);
  for (const k of s.keys) {
    const key = wordsOf(k.en).join(" ");
    if (!key || !` ${whole} `.includes(` ${key} `)) errors.push(`từ khoá "${k.en}" không có trong câu "${s.en}"`);
  }
  return errors;
}
