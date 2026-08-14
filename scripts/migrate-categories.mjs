/**
 * Dựng lại cây danh mục tài chính, song ngữ, hai cấp.
 *
 * Bối cảnh: bảng Category nhập từ Google Sheet nên phẳng hoàn toàn — 26 mục,
 * không mục nào có parentId. "Breakfast" vì thế nằm ngang hàng với
 * "Food & Dining" thay vì là con của nó, và ô "Danh mục con" trong mọi form
 * luôn trống. Cây mới lấy từ Notion "Sub-Categories" của người dùng, cộng vài
 * nhóm bổ sung.
 *
 * `name` (tiếng Anh) là tên CHUẨN — bốn bảng khớp với nó bằng chuỗi:
 * Transaction, Budget, Vendor, ClassificationRule. `nameVi` chỉ để hiển thị.
 * Giữ tiếng Anh làm chuẩn vì process-ocr có fallback viết cứng "Other".
 *
 * Script dời dữ liệu cũ TRƯỚC rồi mới dựng lại bảng Category. Bỏ bước dời là
 * 80 giao dịch trỏ tới nhóm không còn tồn tại — dashboard đếm thiếu mà không
 * báo lỗi gì.
 *
 * Chạy thử (không ghi):  node scripts/migrate-categories.mjs
 * Ghi thật:              node scripts/migrate-categories.mjs --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** [tên chuẩn tiếng Anh, nhãn tiếng Việt, [danh mục con...]] */
const EXPENSE_TREE = [
  ["Food & Dining", "Ăn uống", [
    ["Breakfast", "Ăn sáng"], ["Lunch", "Ăn trưa"], ["Dinner", "Ăn tối"],
    ["Snacks", "Ăn vặt"], ["Coffee", "Cafe"],
  ]],
  // Tách khỏi Ăn uống theo yêu cầu: đây là nhóm chi nhiều nhất (20 giao dịch),
  // gộp chung thì không tách được tiền ăn ngoài với tiền nấu ăn nhà.
  ["Groceries", "Đi chợ", [
    ["Household Food", "Thực phẩm gia đình"], ["Supermarket", "Siêu thị"],
    ["Local Market", "Chợ truyền thống"], ["Produce", "Rau củ quả"],
    ["Meat & Fish", "Thịt cá"], ["Spices & Dry Goods", "Gia vị & đồ khô"],
  ]],
  ["Friends", "Bạn bè", [["Gifts", "Quà tặng"]]],
  ["Personal", "Cá nhân", [
    ["Luck & Offerings", "Cầu may"], ["Adult Toys", "Đồ chơi người lớn"],
    ["Travel", "Du lịch"], ["Haircut", "Hớt tóc"], ["License", "License"],
    ["Phone Top-up", "Nạp card điện thoại"], ["Clothing", "Quần áo"],
    ["Supplements", "Thực phẩm chức năng"],
  ]],
  ["Children", "Con cái", [
    ["Toys", "Đồ chơi"], ["Kids' Shoes", "Giày dép trẻ em"],
    ["Kids' Toiletries", "Hóa mỹ phẩm trẻ em"], ["Đình's Tuition", "Học phí Đình"],
    ["Ryan's Tuition", "Học phí Ryan"], ["Kids' Doctor Visits", "Khám bệnh trẻ em"],
    ["Teacher Gifts", "Quà cô giáo"], ["Milk", "Sữa"], ["Diapers", "Tã"],
    ["Baby Food", "Thực phẩm trẻ em"], ["Kids' Medicine", "Thuốc trẻ em"],
    ["Đình's Vaccinations", "Tiêm ngừa Đình"], ["Ryan's Vaccinations", "Tiêm ngừa Ryan"],
  ]],
  ["Transportation", "Di chuyển", [
    ["Car Maintenance", "Bảo dưỡng xe hơi"], ["Motorbike Maintenance", "Bảo dưỡng xe máy"],
    ["Bus Ticket", "Vé xe buýt"], ["Delivery Fee", "Phí giao hàng"],
    ["Fuel", "Đổ xăng"], ["Parking", "Phí giữ xe"], ["Car Wash", "Rửa xe"],
    ["Taxi", "Taxi"],
  ]],
  ["Household Supplies", "Đồ dùng gia đình", [["Toiletries", "Hóa mỹ phẩm"]]],
  ["Housing", "Nhà cửa", [
    ["Electricity", "Điện"], ["Water", "Nước sinh hoạt"], ["Internet", "Internet"],
    ["Management Fee", "Phí quản lý"], ["Mortgage Principal", "Tiền gốc mua nhà"],
    ["Mortgage Interest", "Lãi mua nhà"],
  ]],
  ["Grandparents", "Ông bà", [
    ["Ancestor Offerings", "Cúng ông bà"],
    ["Senior Supplements", "Thực phẩm chức năng người già"],
    ["Dairy Products", "Thực phẩm từ sữa"],
  ]],
  // Tên nhóm hứa hai thứ nhưng Notion chỉ có "Sách".
  ["Books & Courses", "Sách & khóa học", [["Books", "Sách"], ["Courses", "Khóa học"]]],
  // Phần trẻ em đã có khám bệnh/tiêm ngừa/thuốc, phần người lớn chỉ có thuốc.
  ["Health", "Sức khỏe", [
    ["Adult Medicine", "Thuốc uống người lớn"], ["Doctor Visits", "Khám bệnh"],
    ["Dental", "Nha khoa"], ["Health Insurance", "Bảo hiểm y tế"],
    ["Fitness & Gym", "Thể dục & gym"],
  ]],
  ["Home Appliances", "Thiết bị gia đình", [
    ["Kitchen Utensils", "Dụng cụ nhà bếp"], ["Kitchen Appliances", "Thiết bị nhà bếp"],
    ["Air Conditioning", "Thiết bị điều hòa không khí"],
    ["Entertainment & Media Devices", "Thiết bị giải trí & truyền thông"],
    ["Water Treatment", "Thiết bị xử lý nước"],
  ]],

  // --- Bổ sung, không có trong Notion ---

  // App có sẵn tab Quản lý nợ và hệ cũ có "Debt Payment". Notion chỉ có gốc/lãi
  // mua nhà trong "Nhà cửa" — vay tiêu dùng và thẻ tín dụng chưa có chỗ.
  ["Debt & Installments", "Nợ & trả góp", [
    ["Credit Card Installments", "Trả góp thẻ tín dụng"], ["Consumer Loan", "Vay tiêu dùng"],
    ["Loan Interest", "Lãi vay"], ["Family Loan Repayment", "Trả nợ người thân"],
  ]],
  // Hệ cũ có "Subscription" và "Entertainment", Notion không có nhóm tương ứng.
  ["Entertainment & Subscriptions", "Giải trí & đăng ký", [
    ["App Subscriptions", "Đăng ký ứng dụng"], ["Movies", "Xem phim"],
    ["Music & Podcasts", "Nhạc & podcast"], ["Games", "Game"],
    ["Event Tickets", "Vé sự kiện"],
  ]],
  // Giữ đúng tên "Other": process-ocr dùng chuỗi này làm fallback khi AI không
  // phân loại được. Đổi tên là hoá đơn quét rơi vào nhóm không tồn tại.
  ["Other", "Khác", [
    ["Miscellaneous", "Chi phí phát sinh"], ["Bank Fees", "Phí ngân hàng"],
    ["Taxes & Fees", "Thuế & lệ phí"],
  ]],
];

const INCOME_TREE = [
  // Notion chỉ có Salary. Hệ cũ có thêm Bonus/Freelance/Investment/Other Income —
  // bỏ hết thì tiền thưởng hay freelance không biết ghi vào đâu.
  ["Main Income", "Thu nhập chính", [
    ["Salary", "Lương"], ["Bonus", "Thưởng"], ["Allowance", "Phụ cấp"],
  ]],
  ["Other Income", "Thu nhập khác", [
    ["Freelance", "Freelance"], ["Investment", "Đầu tư"],
    ["Selling Used Items", "Bán đồ cũ"], ["Refunds", "Hoàn tiền"],
    ["Gifts Received", "Được tặng"],
  ]],
];

/**
 * Dời dữ liệu cũ sang tên nhóm mới.
 *
 * Chỉ liệt kê những tên THAY ĐỔI. Vì tên chuẩn vẫn là tiếng Anh nên phần lớn
 * nhóm giữ nguyên — "Food & Dining", "Groceries", "Transportation", "Other"...
 *
 * `sub: null` nghĩa là không suy ra được cấp 2 từ dữ liệu cũ. Ví dụ "Utilities"
 * có thể là điện, nước hay internet — để trống còn hơn đoán sai.
 */
const REMAP = {
  "Breakfast": { group: "Food & Dining", sub: "Breakfast" },
  "Personal Care": { group: "Personal", sub: null },
  "Utilities": { group: "Housing", sub: null },
  "Main income": { group: "Main Income", sub: "Salary" },
  "Groceries": { group: "Groceries", sub: "Household Food" },
};

/** Bảng nào giữ tên danh mục dạng chuỗi. Thiếu một bảng là để lại dữ liệu mồ côi. */
const TABLES = [
  ["transaction", "categoryGroup", "giao dịch"],
  ["budget", "categoryGroup", "ngân sách"],
  ["draftReceipt", "categoryGroup", "hoá đơn nháp"],
  ["vendor", "defaultCategoryGroup", "nhà cung cấp"],
  ["classificationRule", "categoryGroup", "quy tắc phân loại"],
];

const log = (...a) => console.log(...a);

async function main() {
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error("Không tìm thấy user nào");

  log(APPLY ? "=== GHI THẬT ===\n" : "=== CHẠY THỬ — không ghi gì ===\n");

  const before = await prisma.category.findMany({ where: { userId: user.id } });
  log(`Danh mục hiện có: ${before.length} (${before.filter((c) => c.parentId).length} có cha)`);

  // --- Dữ liệu bị ảnh hưởng --------------------------------------------------
  log("\n--- Dữ liệu sẽ được dời ---");
  for (const [model, field, label] of TABLES) {
    const rows = await prisma[model].groupBy({ by: [field], _count: { _all: true } });
    if (!rows.length) { log(`  ${label}: (rỗng)`); continue; }
    for (const r of rows) {
      const from = r[field];
      const to = REMAP[from];
      const n = r._count._all;
      if (to) log(`  ${label}: ${String(from).padEnd(16)} ${String(n).padStart(3)} → ${to.group}${to.sub ? " / " + to.sub : "  (cấp 2 để trống)"}`);
      else log(`  ${label}: ${String(from ?? "(trống)").padEnd(16)} ${String(n).padStart(3)} → giữ nguyên`);
    }
  }

  // --- Cây mới ---------------------------------------------------------------
  const all = [...EXPENSE_TREE, ...INCOME_TREE];
  const subTotal = all.reduce((s, [, , subs]) => s + subs.length, 0);
  log(`\n--- Cây mới: ${all.length} nhóm, ${subTotal} danh mục con ---`);
  for (const [en, vi, subs] of EXPENSE_TREE) {
    log(`\n  ${en}  —  ${vi}`);
    log(`      ${subs.map(([e, v]) => `${e} (${v})`).join(" · ")}`);
  }
  for (const [en, vi, subs] of INCOME_TREE) {
    log(`\n  ${en}  —  ${vi}   [thu nhập]`);
    log(`      ${subs.map(([e, v]) => `${e} (${v})`).join(" · ")}`);
  }

  if (!APPLY) { log("\nChạy lại với --apply để ghi thật."); return; }

  // --- Ghi -------------------------------------------------------------------
  // Dời dữ liệu TRƯỚC khi đụng bảng Category: nếu bước sau hỏng thì dữ liệu vẫn
  // trỏ tới nhóm có thật, thay vì kẹt giữa hai hệ tên.
  log("\n--- Dời dữ liệu ---");
  for (const [from, to] of Object.entries(REMAP)) {
    for (const [model, field, label] of TABLES) {
      const data = { [field]: to.group };
      // subGroup chỉ có ở Transaction.
      if (to.sub && model === "transaction") data.subGroup = to.sub;
      const r = await prisma[model].updateMany({ where: { [field]: from }, data });
      if (r.count) log(`  ${label}: ${from} → ${to.group} (${r.count})`);
    }
  }

  // Xoá rồi dựng lại. An toàn vì không bảng nào có khoá ngoại trỏ vào Category —
  // chúng khớp bằng tên, và tên đã được dời ở trên.
  const del = await prisma.category.deleteMany({
    where: { userId: user.id, kind: { in: ["expense_group", "income_group"] } },
  });
  log(`\n  xoá ${del.count} danh mục cũ`);

  for (const [kind, tree] of [["expense_group", EXPENSE_TREE], ["income_group", INCOME_TREE]]) {
    for (const [en, vi, subs] of tree) {
      const parent = await prisma.category.create({
        data: { kind, name: en, nameVi: vi, userId: user.id },
      });
      for (const [subEn, subVi] of subs) {
        await prisma.category.create({
          data: { kind, name: subEn, nameVi: subVi, parentId: parent.id, userId: user.id },
        });
      }
    }
  }

  const after = await prisma.category.findMany({ where: { userId: user.id } });
  log(`\nXong. Danh mục: ${after.length} (${after.filter((c) => c.parentId).length} có cha)`);
}

main()
  .catch((e) => { console.error("LỖI:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
