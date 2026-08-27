import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { normalizeSupplier } from "@/lib/invoice";

export const dynamic = "force-dynamic";

/** Nhiều hơn số này thì danh sách gợi ý chỉ tổ nặng, không ai cuộn tới cuối. */
const MAX_SUPPLIERS = 300;

/** Giá trị rác do route transaction ghi khi form bỏ trống ô "Nơi chi". */
const PLACEHOLDER_NAMES = new Set(["n/a", "na", "unknown", ""]);

interface Defaults {
  categoryGroup: string;
  subGroup: string | null;
  /** Số giao dịch đứng sau tổ hợp này — dùng để chọn tổ hợp phổ biến nhất. */
  count: number;
}

interface Entry {
  name: string;
  count: number;
  lastUsedAt: string | null;
  /** Cách viết tên → số lần dùng, để chọn cách viết phổ biến nhất. */
  spellings: Map<string, number>;
  /** Nhóm/danh mục con hay dùng nhất, tách theo loại giao dịch. */
  defaultsByType: Map<string, Defaults>;
}

/**
 * Danh sách "Nơi chi / Nguồn thu" đã từng dùng, để ô nhập gợi ý khi gõ.
 *
 * Không có bảng danh mục riêng cho nơi chi: nguồn thật là cột
 * `Transaction.supplier` mà chính người dùng đã gõ, cộng thêm bảng `Vendor` do
 * luồng duyệt OCR sinh ra. Gộp cả hai, nếu không thì một quán chỉ mới xuất hiện
 * qua hoá đơn quét sẽ không bao giờ được gợi ý.
 *
 * Khoá gộp là `normalizeSupplier` (bỏ dấu, thường hoá) — "Cafe Cốc Q1",
 * "cafe coc q1" và "CAFE  CỐC  Q1" là một chỗ; nếu để nguyên văn thì danh sách
 * gợi ý sẽ đầy các biến thể chỉ khác nhau cái dấu, và báo cáo theo nơi chi cũng
 * tách làm nhiều mảnh. Tên hiển thị lấy theo cách viết được dùng nhiều nhất.
 *
 * Kèm theo mỗi nơi là nhóm chi tiêu hay dùng nhất của nơi đó, TÁCH THEO LOẠI
 * giao dịch: cùng một cái tên có thể vừa là nơi chi vừa là nguồn thu, mà nhóm
 * thu nhập điền vào một khoản chi thì thành dữ liệu hỏng.
 *
 * Lọc ngay trên máy khách nên ở đây trả cả danh sách một lần, không nhận tham
 * số `q`: gõ tới đâu lọc tới đó, không phải chờ mạng từng ký tự.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const [transactionGroups, vendors] = await Promise.all([
      // Gộp theo cả bốn cột để vừa đếm được số lần dùng, vừa biết tổ hợp
      // nhóm/danh mục con nào hay đi với nơi này nhất.
      prisma.transaction.groupBy({
        by: ["supplier", "type", "categoryGroup", "subGroup"],
        where: { userId: user.id },
        _count: { _all: true },
        _max: { date: true },
      }),
      prisma.vendor.findMany({
        where: { userId: user.id },
        select: { vendorName: true, defaultCategoryGroup: true },
      }),
    ]);

    const merged = new Map<string, Entry>();

    const entryFor = (rawName: string): Entry | null => {
      const name = String(rawName ?? "").trim();
      const key = normalizeSupplier(name);
      if (!key || PLACEHOLDER_NAMES.has(name.toLowerCase())) return null;

      let entry = merged.get(key);
      if (!entry) {
        entry = { name, count: 0, lastUsedAt: null, spellings: new Map(), defaultsByType: new Map() };
        merged.set(key, entry);
      }
      entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
      return entry;
    };

    for (const row of transactionGroups) {
      const entry = entryFor(row.supplier);
      if (!entry) continue;

      const count = row._count._all;
      entry.count += count;

      const lastUsedAt = row._max.date?.toISOString() ?? null;
      if (lastUsedAt && (!entry.lastUsedAt || lastUsedAt > entry.lastUsedAt)) {
        entry.lastUsedAt = lastUsedAt;
      }

      // Nhóm rỗng thì không có gì để gợi ý.
      if (!row.categoryGroup) continue;
      const current = entry.defaultsByType.get(row.type);
      if (!current || count > current.count) {
        entry.defaultsByType.set(row.type, {
          categoryGroup: row.categoryGroup,
          subGroup: row.subGroup,
          count,
        });
      }
    }

    // Vendor chưa gắn với giao dịch nào thì count = 0: vẫn gợi ý được, nhưng
    // luôn nằm dưới những nơi thật sự hay dùng. Nhóm mặc định của Vendor do
    // luồng hoá đơn quét học được, nên chỉ áp cho khoản chi — và chỉ khi lịch
    // sử giao dịch chưa nói gì khác.
    for (const vendor of vendors) {
      const entry = entryFor(vendor.vendorName);
      if (!entry) continue;
      if (vendor.defaultCategoryGroup && !entry.defaultsByType.has("Expense")) {
        entry.defaultsByType.set("Expense", {
          categoryGroup: vendor.defaultCategoryGroup,
          subGroup: null,
          count: 0,
        });
      }
    }

    const data = [...merged.values()]
      .map((entry) => {
        // Cách viết phổ biến hơn thắng, để gợi ý hiện đúng thứ người dùng quen gõ.
        const name = [...entry.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const defaultsByType: Record<string, { categoryGroup: string; subGroup: string | null }> = {};
        for (const [type, preset] of entry.defaultsByType) {
          defaultsByType[type] = { categoryGroup: preset.categoryGroup, subGroup: preset.subGroup };
        }
        return { name, count: entry.count, lastUsedAt: entry.lastUsedAt, defaultsByType };
      })
      .sort(
        (a, b) =>
          b.count - a.count ||
          (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") ||
          a.name.localeCompare(b.name, "vi")
      )
      .slice(0, MAX_SUPPLIERS);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load suppliers:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
