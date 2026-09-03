import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nhập tối đa 100 từ một lượt — bằng đúng giới hạn của bản tham chiếu. */
const MAX_ROWS = 100;

/**
 * Cột nhận được, theo thứ tự trong file mẫu.
 *
 * Nhận cả tên tiếng Việt lẫn tiếng Anh để dán từ Excel kiểu nào cũng chạy.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  term: ["term", "word", "từ", "tu", "chữ", "chu"],
  phonetic: ["phonetic", "reading", "pinyin", "jyutping", "ipa", "romaja", "phiên âm", "phien am", "cách đọc"],
  tone: ["tone", "thanh", "thanh điệu", "thanh dieu"],
  definition: ["definition", "meaning", "nghĩa", "nghia", "định nghĩa"],
  example: ["example", "ví dụ", "vi du", "câu ví dụ"],
  exampleTranslation: ["exampletranslation", "translation", "dịch", "dich", "bản dịch", "nghĩa câu"],
  tags: ["tags", "tag", "thẻ", "the", "nhãn"],
};

/**
 * Tách một dòng CSV, tôn trọng dấu nháy kép.
 *
 * Không dùng `split(",")` được: câu ví dụ gần như luôn có dấu phẩy, mà đó lại
 * là cột người ta hay dán nhất.
 */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        // "" bên trong vùng nháy nghĩa là một dấu nháy thật.
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === "\t" || ch === ";") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Đoán cột nào là cột nào từ dòng tiêu đề. */
function mapHeader(cells: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  cells.forEach((cell, i) => {
    const key = cell.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(key) && map[field] === undefined) map[field] = i;
    }
  });
  return map;
}

interface ParsedRow {
  line: number;
  term: string;
  phonetic: string | null;
  tone: string | null;
  definition: string;
  example: string | null;
  exampleTranslation: string | null;
  tags: string[];
  error: string | null;
}

function parseCsv(csv: string): { rows: ParsedRow[]; hasHeader: boolean } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows: [], hasHeader: false };

  const first = parseLine(lines[0]);
  const header = mapHeader(first);
  // Có dòng tiêu đề khi nhận ra được ít nhất cột "từ" và cột "nghĩa".
  const hasHeader = header.term !== undefined && header.definition !== undefined;

  // Không có tiêu đề thì đi theo thứ tự cột của file mẫu.
  const cols = hasHeader
    ? header
    : { term: 0, phonetic: 1, tone: 2, definition: 3, example: 4, exampleTranslation: 5, tags: 6 };

  const body = hasHeader ? lines.slice(1) : lines;

  const rows = body.slice(0, MAX_ROWS).map((line, i) => {
    const c = parseLine(line);
    const at = (k: string) => {
      const idx = (cols as Record<string, number>)[k];
      return idx === undefined ? "" : (c[idx] ?? "").trim();
    };

    const term = at("term");
    const definition = at("definition");
    const tagsRaw = at("tags");

    return {
      line: i + 1 + (hasHeader ? 1 : 0),
      term,
      phonetic: at("phonetic") || null,
      tone: at("tone") || null,
      definition,
      example: at("example") || null,
      exampleTranslation: at("exampleTranslation") || null,
      tags: tagsRaw ? tagsRaw.split(/[;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 10) : [],
      error: !term ? "Thiếu từ" : !definition ? "Thiếu nghĩa" : null,
    };
  });

  return { rows, hasHeader };
}

/**
 * Nhập từ vựng hàng loạt.
 *
 * Luôn chạy hai lượt: `dryRun` để xem trước rồi mới ghi thật. Dán nhầm cột mà
 * ghi thẳng 100 dòng rác vào kho thì dọn tay rất lâu — xem trước rẻ hơn nhiều.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { csv, deckId, languageId, domain, dryRun, createFlashcards } = await req.json();
    const text = String(csv ?? "");

    if (!text.trim()) {
      return NextResponse.json({ success: false, error: "Chưa có nội dung để nhập" }, { status: 400 });
    }

    const { rows, hasHeader } = parseCsv(text);
    const valid = rows.filter((r) => !r.error);
    const invalid = rows.filter((r) => r.error);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        hasHeader,
        total: rows.length,
        validCount: valid.length,
        invalidCount: invalid.length,
        rows,
      });
    }

    if (valid.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không có dòng nào hợp lệ để nhập" },
        { status: 400 }
      );
    }

    // Bộ thẻ và ngôn ngữ phải thuộc về chính người dùng.
    const deck = deckId
      ? await prisma.deck.findFirst({ where: { id: String(deckId), userId: user.id } })
      : null;
    if (deckId && !deck) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bộ thẻ" }, { status: 404 });
    }
    const language = languageId
      ? await prisma.language.findFirst({ where: { id: String(languageId), userId: user.id } })
      : null;
    if (languageId && !language) {
      return NextResponse.json({ success: false, error: "Không tìm thấy ngôn ngữ" }, { status: 404 });
    }

    // Bỏ qua từ đã có sẵn trong cùng bộ — nhập lại cùng một file không nên đẻ
    // ra thẻ trùng.
    const existing = await prisma.dictionaryItem.findMany({
      where: {
        userId: user.id,
        ...(deck ? { deckId: deck.id } : {}),
        term: { in: valid.map((r) => r.term) },
      },
      select: { term: true },
    });
    const taken = new Set(existing.map((e) => e.term.toLowerCase()));
    const fresh = valid.filter((r) => !taken.has(r.term.toLowerCase()));

    const wantCards = createFlashcards !== false;

    // Tạo tuần tự trong một giao dịch: hoặc vào hết, hoặc không dòng nào vào.
    const created = await prisma.$transaction(
      fresh.map((r) =>
        prisma.dictionaryItem.create({
          data: {
            term: r.term,
            definition: r.definition,
            phonetic: r.phonetic,
            tone: r.tone,
            example: r.example,
            exampleTranslation: r.exampleTranslation,
            tags: r.tags,
            domain: domain ?? null,
            deckId: deck?.id ?? null,
            languageId: language?.id ?? null,
            userId: user.id,
            ...(wantCards
              ? { flashcard: { create: { front: r.term, back: r.definition, userId: user.id } } }
              : {}),
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      createdCount: created.length,
      skippedCount: valid.length - fresh.length,
      invalidCount: invalid.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không nhập được";
    console.error("Bulk import error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
