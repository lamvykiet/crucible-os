import { prisma } from "@/lib/prisma";

/**
 * `projectId` gửi từ form, chỉ nhận nếu dự án thuộc đúng người dùng.
 *
 * Khoá ngoại chỉ đảm bảo dự án TỒN TẠI, không đảm bảo nó là của ai — id lấy
 * từ body thì không tin được. Chuỗi rỗng nghĩa là bỏ gắn dự án.
 */
export async function ownedProjectId(userId: string, projectId: unknown) {
  if (typeof projectId !== "string" || !projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  return project?.id ?? null;
}
