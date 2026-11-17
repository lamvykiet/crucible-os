/**
 * Lấy phần chữ của một bài báo từ link, cho Đọc & dịch.
 *
 * Không giả trình duyệt để lách chặn (xem ghi chú nguồn video): gửi một
 * User-Agent ghi rõ là Crucible. Trang nào chặn thì báo người dùng dán nội dung
 * vào ô "Dán văn bản" — đó là đường đi chắc chắn chạy.
 *
 * Chỉ nhận http/https tới tên miền công khai: route này chạy ở máy chủ, để
 * ngỏ là ai đó có thể bắt nó gọi vào địa chỉ nội bộ.
 */

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

export function checkArticleUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ArticleError("Link không hợp lệ.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ArticleError("Chỉ nhận link http hoặc https.");
  if (PRIVATE_HOST.test(url.hostname)) throw new ArticleError("Không đọc được địa chỉ nội bộ.");
  return url;
}

export class ArticleError extends Error {}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  mdash: "—", ndash: "–", hellip: "…",
};

function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const stripTags = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Rút tiêu đề và các đoạn văn từ HTML. Ưu tiên khối <article>, rồi <main>. */
export function extractArticle(html: string): { title: string; paragraphs: string[] } {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|header|aside|figure|form)[\s\S]*?<\/\1>/gi, " ");

  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const title = decode(og ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();

  const scope =
    clean.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    clean.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    clean;

  const paragraphs = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((p) => p.split(" ").length >= 8);

  return { title, paragraphs };
}

export async function fetchArticle(raw: string) {
  const url = checkArticleUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CrucibleOS-Reader/1.0 (personal study app)", Accept: "text/html" },
    });
    if (!res.ok) throw new ArticleError(`Trang trả lỗi ${res.status}. Dán nội dung bài vào ô "Dán văn bản".`);
    const html = (await res.text()).slice(0, 2_000_000);
    const { title, paragraphs } = extractArticle(html);
    const text = paragraphs.join("\n\n");
    if (text.length < 300) {
      throw new ArticleError('Không lấy được nội dung bài từ link này (trang chặn hoặc cần đăng nhập). Dán nội dung vào ô "Dán văn bản".');
    }
    return { title, text, url: url.toString() };
  } catch (err) {
    if (err instanceof ArticleError) throw err;
    throw new ArticleError('Không tải được trang. Dán nội dung bài vào ô "Dán văn bản".');
  } finally {
    clearTimeout(timer);
  }
}
