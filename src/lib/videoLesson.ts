/**
 * Video học tiếng — phần thuần (không DB, không mạng), có test.
 *
 * Phụ đề lấy bằng Gemini đọc thẳng link YouTube công khai (tính năng chính thức
 * của API, không cào trang). Một video dài không xử lý trọn trong 60 giây của
 * Vercel, nên làm THEO ĐOẠN `CHUNK_SECONDS`: mỗi lần lấy thêm một đoạn rồi nối.
 * Câu cuối của một đoạn thường bị cắt ngang ở ranh giới — bỏ nó đi và cho đoạn
 * sau bắt đầu lại từ đầu câu đó.
 */

export const CHUNK_SECONDS = 180;

export interface Segment {
  start: number;
  end: number;
  en: string;
  vi: string;
}

export interface SegmentStore {
  /** Đã xử lý tới giây thứ mấy. */
  until: number;
  /** Đã hết video (lượt cuối không trả thêm câu nào). */
  complete: boolean;
  items: Segment[];
}

/** Lấy ID 11 ký tự từ mọi dạng link YouTube thường gặp. */
export function parseYouTubeId(raw: string): string | null {
  const s = raw.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v")!.slice(0, 11);
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}

export function parseStore(raw: string): SegmentStore {
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return { until: v.at(-1)?.end ?? 0, complete: true, items: v };
    return { until: Number(v.until) || 0, complete: Boolean(v.complete), items: Array.isArray(v.items) ? v.items : [] };
  } catch {
    return { until: 0, complete: false, items: [] };
  }
}

const clean = (s: Partial<Segment>): Segment | null => {
  const start = Number(s.start);
  const end = Number(s.end);
  const en = String(s.en ?? "").trim();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !en) return null;
  return { start: Math.max(0, start), end, en, vi: String(s.vi ?? "").trim() };
};

/**
 * Nối một đoạn mới vào kho.
 *
 * - Bỏ câu nằm trước `chunkStart` (trùng với đoạn trước).
 * - Câu cuối kết thúc sát ranh giới đoạn bị coi là cắt dở: bỏ, và lượt sau bắt
 *   đầu từ `start` của nó.
 * - Đoạn không trả câu nào mới ⇒ hết video.
 */
export function mergeChunk(prev: SegmentStore, raw: Partial<Segment>[], chunkStart: number, chunkEnd: number): SegmentStore {
  const items = raw
    .map(clean)
    .filter((s): s is Segment => s !== null && s.start >= chunkStart - 0.5)
    .sort((a, b) => a.start - b.start);

  if (items.length === 0) return { ...prev, until: Math.max(prev.until, chunkStart), complete: true };

  let until = chunkEnd;
  const last = items[items.length - 1];
  if (items.length > 1 && last.end >= chunkEnd - 1.5) {
    items.pop();
    until = last.start;
  }
  const complete = last.end < chunkEnd - 8; // video dừng hẳn trước khi hết đoạn
  return { until, complete, items: [...prev.items, ...items] };
}
