// Đẩy danh sách video gom từ Facebook vào bảng VideoItem.
// Lặp lại đúng logic của POST /api/video/queue: dedupe theo (userId, sourceUrl),
// chuẩn hoá nhãn con theo biến thể đã có, status "pending".
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PROJECT = "/Volumes/AI_BRAIN/05. Secon brain/06. Crucible-os";
const USER_ID = process.env.CRU_USER_ID;
const DRY = process.argv.includes("--dry");

const detectPlatform = (url) => {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("facebook.com") || host === "fb.watch" || host.includes("fb.com")) return "facebook";
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  if (host.includes("instagram.com")) return "instagram";
  return "other";
};

const isValidHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeSubTopic = (v) => {
  const t = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return t || null;
};

// Bỏ dấu để "Học tiếng trung" bên Facebook khớp "Học tiếng Trung" trên Drive.
const norm = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function readEnv() {
  return Object.fromEntries(
    fs.readFileSync(path.join(PROJECT, ".env"), "utf8")
      .split("\n").filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
}

async function driveTopics() {
  const env = readEnv();
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  }).then((r) => r.json());

  const q = `'${env.GOOGLE_DRIVE_VIDEO_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(name)&pageSize=200`,
    { headers: { authorization: "Bearer " + tok.access_token } }
  ).then((r) => r.json());
  return (r.files || []).map((f) => f.name);
}

(async () => {
  const raw = fs.readFileSync(process.argv[2], "utf8");
  // Bản đổ thẳng từ Arc là chuỗi JSON bọc hai lần; bản đã giải nén thì bọc một
  // lần. Nhận cả hai để không phụ thuộc vào việc file đến từ đâu.
  const once = JSON.parse(raw);
  const items = typeof once === "string" ? JSON.parse(once) : once;
  const topics = await driveTopics();
  console.log(`${items.length} video | ${topics.length} đề tài Drive`);

  // Tên collection bên Facebook và tên thư mục Drive là hai thứ người dùng gõ
  // ở hai nơi khác nhau, cùng nghĩa nhưng khác chữ. Chỉ những cặp chắc chắn
  // mới ghép cứng ở đây; cái nào mơ hồ để rơi vào "Khác" còn hơn xếp nhầm.
  const ALIAS = {
    "work out": "Luyện tập thể hình",
    "video edit": "Quay chụp chỉnh sửa ảnh",
    "chup anh": "Quay chụp chỉnh sửa ảnh",
    "personal dev": "Phát triển bản thân",
  };

  // Khớp theo từ nguyên vẹn, không phải chuỗi con: "AI" nằm lọt trong
  // "Prompt AI bán hàng" theo kiểu chuỗi con, và luật lỏng đó từng kéo cả 25
  // video bán hàng vào đề tài AI.
  const tokensMatch = (a, b) => {
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    const st = short.split(" "), lt = new Set(long.split(" "));
    return st.some((w) => w.length >= 4) && st.every((w) => lt.has(w));
  };

  const pick = (c) =>
    topics.find((t) => norm(t) === norm(c)) ||
    (ALIAS[norm(c)] && topics.includes(ALIAS[norm(c)]) ? ALIAS[norm(c)] : null) ||
    topics.find((t) => tokensMatch(norm(t), norm(c))) ||
    "Khác";

  // Xem trước bản đồ ghép trước khi ghi một dòng nào.
  const mapping = {};
  for (const it of items) (mapping[it.collection] ??= { topic: pick(it.collection), n: 0 }).n++;
  console.table(mapping);
  if (DRY) {
    console.log("— chạy thử, không ghi gì —");
    return;
  }

  const subCache = new Map();
  const stats = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (const [i, it] of items.entries()) {
    if (!isValidHttpUrl(it.url)) {
      stats.skipped++;
      continue;
    }
    const topic = pick(it.collection);
    // Collection không khớp thư mục nào thì giữ tên gốc làm nhãn con, nếu không
    // cả đống rơi vào "Khác" và mất dấu nguồn.
    let subTopic = topic === "Khác" ? normalizeSubTopic(it.collection) : null;
    if (subTopic) {
      const key = topic + "|" + subTopic.toLowerCase();
      if (subCache.has(key)) {
        subTopic = subCache.get(key);
      } else {
        const seen = await prisma.videoItem.findFirst({
          where: { userId: USER_ID, topic, subTopic: { equals: subTopic, mode: "insensitive" } },
          select: { subTopic: true },
          orderBy: { createdAt: "asc" },
        });
        subTopic = seen?.subTopic ?? subTopic;
        subCache.set(key, subTopic);
      }
    }

    try {
      const existing = await prisma.videoItem.findFirst({
        where: { userId: USER_ID, sourceUrl: it.url },
      });
      if (existing) {
        await prisma.videoItem.update({
          where: { id: existing.id },
          data: { topic, subTopic: subTopic ?? existing.subTopic, title: it.title || existing.title },
        });
        stats.updated++;
      } else {
        await prisma.videoItem.create({
          data: {
            sourceUrl: it.url,
            platform: detectPlatform(it.url),
            topic,
            subTopic,
            title: it.title || null,
            status: "pending",
            userId: USER_ID,
          },
        });
        stats.created++;
      }
    } catch (e) {
      stats.failed++;
      console.log(`  x ${it.url}: ${e.message.split("\n")[0]}`);
    }
    if ((i + 1) % 50 === 0) console.log(`  ... ${i + 1}/${items.length}`);
  }

  console.log("\n" + JSON.stringify(stats));
  const after = await prisma.videoItem.groupBy({
    by: ["topic"],
    where: { userId: USER_ID },
    _count: { _all: true },
  });
  console.table(after.map((r) => ({ topic: r.topic, n: r._count._all })));
})()
  .catch((e) => {
    console.error("ERR", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
