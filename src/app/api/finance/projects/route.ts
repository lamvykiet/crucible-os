export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PROJECT_STATUSES, projectTotals, type ProjectStatus } from "@/lib/projects";
import { loadProjectRows } from "@/lib/projectData";

// Dự án: một lăng kính thứ hai trên sổ thu chi. Giao dịch phân bổ cho dự án vẫn
// nằm trong Chi tiêu/Thu nhập chung — ở đây chỉ gom chúng lại để hỏi "dự án
// này lời hay lỗ".

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "asc" }],
    });
    const rows = await loadProjectRows(user.id);

    // Đang chạy lên trước, đóng xuống cuối — thứ tự người dùng hay cần nhất.
    const rank = (s: string) => Math.max(0, PROJECT_STATUSES.indexOf(s as ProjectStatus));
    const data = projects
      .map((p) => ({
        ...p,
        startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
        totals: projectTotals(
          rows.filter((r) => r.allocation.projectId === p.id).map((r) => r.row),
          p.budget
        ),
      }))
      .sort((a, b) => rank(a.status) - rank(b.status));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Nhận và làm sạch dữ liệu từ form. */
function parseBody(body: Record<string, unknown>) {
  const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max).trim();
  const budget =
    body.budget === null || body.budget === undefined || body.budget === ""
      ? null
      : Math.max(0, Math.round(Number(body.budget) || 0)) || null;
  const status = str(body.status) as ProjectStatus;
  return {
    name: str(body.name, 120),
    status: PROJECT_STATUSES.includes(status) ? status : "active",
    budget,
    startDate:
      typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate)
        ? new Date(`${body.startDate}T00:00:00Z`)
        : null,
    notes: str(body.notes, 1000) || null,
  };
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const parsed = parseBody(await req.json());
    if (!parsed.name) {
      return NextResponse.json({ success: false, error: "Thiếu tên dự án" }, { status: 400 });
    }
    const created = await prisma.project.create({ data: { ...parsed, userId: user.id } });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    const parsed = parseBody(body);
    if (!id || !parsed.name) {
      return NextResponse.json({ success: false, error: "Thiếu id hoặc tên dự án" }, { status: 400 });
    }
    // Lọc theo userId trong chính câu update: không cho sửa dự án của người khác.
    const result = await prisma.project.updateMany({
      where: { id, userId: user.id },
      data: parsed,
    });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Xoá dự án. Giao dịch KHÔNG bị xoá theo — chỉ phân bổ và sổ cái của riêng dự
 * án này mất (cascade); giao dịch vẫn nằm nguyên trong sổ thu chi.
 */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
    }
    const result = await prisma.project.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
