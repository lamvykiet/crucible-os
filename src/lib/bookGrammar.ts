import { prisma } from "@/lib/prisma";
import { syllabusFor, findPoint, type GrammarFamily, type GrammarSyllabus } from "@/lib/grammarSyllabus";

/**
 * Trộn ngữ pháp rút từ sách vào khung ngữ pháp có sẵn.
 *
 * Khung chính nằm trong code vì thứ tự học cần ổn định và không được đổi mỗi
 * lần mở trang. Nhưng sách người dùng tải lên thì không biết trước, nên phần
 * đến từ sách nằm trong bảng `BookGrammarNote` và được trộn vào lúc ĐỌC. Hai
 * nguồn, một đường đọc — nên không có chuyện khung trong code và khung trên màn
 * hình nói hai chuyện khác nhau.
 *
 * Hai đường trộn, đúng như yêu cầu "chưa có thì tạo, có rồi mà thiếu thì bổ
 * sung":
 *
 * - Điểm của sách TRÙNG một điểm đã có trong khung (AI nhận ra lúc soạn bài và
 *   ghi lại id) → thành phần BỔ SUNG treo vào điểm đó. Không tạo điểm thứ hai,
 *   vì hai điểm cùng nội dung nằm cạnh nhau là người học phải tự đoán nên đọc
 *   cái nào.
 * - Điểm khung CHƯA CÓ → thành điểm mới, xếp vào một họ riêng mang tên sách.
 *   Đặt riêng chứ không nhét vào họ cũ: thứ tự trong họ cũ là thứ tự sư phạm đã
 *   cân, chèn ngang vào giữa là phá nó.
 */

/** Tiền tố để nhìn một id là biết nó đến từ sách, không phải từ khung trong code. */
export const BOOK_POINT_PREFIX = "book:";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

/**
 * Id bền cho một điểm đến từ sách.
 *
 * Gồm sách, bước và tên điểm — đúng bộ ba làm khoá duy nhất của bảng, nên soạn
 * lại bài học của unit đó sẽ cho ra đúng id cũ và tiến độ học không bị mất.
 */
export const bookPointId = (bookId: string, step: number, title: string) =>
  `${BOOK_POINT_PREFIX}${bookId}.${step}.${slug(title)}`;

export const isBookPoint = (pointId: string) => pointId.startsWith(BOOK_POINT_PREFIX);

export interface NoteRow {
  bookId: string;
  bookTitle: string;
  step: number;
  stepLabel: string;
  title: string;
  level: string;
  rule: string;
  structures: string;
  examples: string;
  syllabusPointId: string | null;
}

const parse = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export interface Supplement {
  bookTitle: string;
  stepLabel: string;
  title: string;
  rule: string;
  structures: { pattern: string; note?: string }[];
  examples: { sentence: string; note?: string }[];
}

/**
 * Khung đã trộn, kèm bảng tra phần bổ sung theo id điểm.
 *
 * Trả cả `bookFamilyIds` để giao diện nói rõ họ nào đến từ sách — người học cần
 * biết phần nào là khung của ứng dụng, phần nào do sách của họ mang vào.
 */
export function mergeBookNotes(syllabus: GrammarSyllabus, notes: NoteRow[]) {
  const supplements: Record<string, Supplement[]> = {};
  const byBook = new Map<string, { title: string; notes: NoteRow[] }>();

  for (const note of notes) {
    if (note.syllabusPointId) {
      (supplements[note.syllabusPointId] ??= []).push({
        bookTitle: note.bookTitle,
        stepLabel: note.stepLabel,
        title: note.title,
        rule: note.rule,
        structures: parse(note.structures, []),
        examples: parse(note.examples, []),
      });
      continue;
    }
    const entry = byBook.get(note.bookId) ?? { title: note.bookTitle, notes: [] };
    entry.notes.push(note);
    byBook.set(note.bookId, entry);
  }

  const bookFamilies: GrammarFamily[] = [];
  for (const [bookId, entry] of byBook) {
    // Nhóm theo unit, giữ đúng thứ tự unit của sách — đó chính là thứ tự học mà
    // tác giả sách đã cân, không có lý gì xếp lại.
    const byStep = new Map<number, NoteRow[]>();
    for (const note of entry.notes) {
      const list = byStep.get(note.step) ?? [];
      list.push(note);
      byStep.set(note.step, list);
    }

    bookFamilies.push({
      id: `${BOOK_POINT_PREFIX}${bookId}`,
      title: entry.title,
      groups: [...byStep.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([step, list]) => ({
          id: `${BOOK_POINT_PREFIX}${bookId}.${step}`,
          title: `${list[0].stepLabel}. ${list[0].title}`,
          points: list.map((note) => ({
            id: bookPointId(note.bookId, note.step, note.title),
            title: note.title,
            level: note.level,
          })),
        })),
    });
  }

  return {
    families: [...syllabus.families, ...bookFamilies],
    supplements,
    bookFamilyIds: bookFamilies.map((f) => f.id),
  };
}

/** Đọc mọi ghi chú ngữ pháp từ sách của một người, cho một thứ tiếng. */
export const loadBookNotes = (userId: string, langCode: string) =>
  prisma.bookGrammarNote.findMany({
    where: { userId, langCode },
    select: {
      bookId: true, bookTitle: true, step: true, stepLabel: true, title: true,
      level: true, rule: true, structures: true, examples: true, syllabusPointId: true,
    },
    orderBy: [{ bookId: "asc" }, { step: "asc" }, { title: "asc" }],
  });

/**
 * Tra một điểm ngữ pháp, tìm cả trong khung code lẫn trong phần đến từ sách.
 *
 * Trả về đúng hình dạng mà `findPoint` trả, nên các route soạn bài và soạn bài
 * tập chỉ cần đổi một dòng gọi là chạy được với cả hai loại điểm. Không có lớp
 * này thì điểm nào của sách cũng hiện trên khung nhưng bấm vào là "không tìm
 * thấy bài này".
 */
export async function resolvePoint(userId: string, langCode: string, pointId: string) {
  const inCode = findPoint(langCode, pointId);
  if (inCode) return inCode;

  if (!isBookPoint(pointId)) return null;

  const syllabus = syllabusFor(langCode);
  const notes = await loadBookNotes(userId, langCode);
  const note = notes.find((n) => bookPointId(n.bookId, n.step, n.title) === pointId);
  if (!note) return null;

  return {
    // Thứ tiếng chưa có khung riêng thì dựng một khung tối thiểu từ chính cấp
    // của sách: phần soạn bài chỉ cần tên thang và cấp để nói đúng độ khó.
    syllabus:
      syllabus ??
      ({
        code: langCode,
        scale: "CEFR",
        levels: [note.level],
        families: [],
        references: [],
      } as GrammarSyllabus),
    family: { id: `${BOOK_POINT_PREFIX}${note.bookId}`, title: note.bookTitle, groups: [] },
    group: {
      id: `${BOOK_POINT_PREFIX}${note.bookId}.${note.step}`,
      title: `${note.stepLabel}. ${note.title}`,
      points: [],
    },
    point: { id: pointId, title: note.title, level: note.level },
    /**
     * Ghi chú gốc của sách, trả kèm để đường soạn bài dùng thẳng.
     *
     * Ghi chú ĐÃ CÓ đủ một bài học — quy tắc, cấu trúc, ví dụ — nên gọi AI viết
     * lại đúng thứ vừa viết xong là đốt hạn mức cho không. Trả ở đây, tại chỗ
     * duy nhất tra điểm ngữ pháp, thay vì gieo sẵn lúc ghi: gieo lúc ghi thì
     * dòng nào vào bảng bằng đường khác là mất phần gieo, mà không có gì báo.
     */
    note: {
      summary: note.rule,
      structures: note.structures,
      examples: note.examples,
    },
  };
}
