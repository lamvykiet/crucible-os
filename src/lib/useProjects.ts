"use client";

import { useEffect, useState } from "react";

// Danh sách dự án để điền vào ô "Thuộc dự án" của ba hộp thoại ghi giao dịch
// (nhập tay, quét hoá đơn, duyệt hoá đơn) — cùng lý do với `useAccounts`.

export interface ProjectOption {
  id: string;
  name: string;
  /** active | paused | closed */
  status: string;
}

/** `refreshKey` đổi thì tải lại — tab Dự án vừa tạo dự án mới thì ô chọn phải có nó. */
export function useProjects(refreshKey = 0) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/finance/projects", { signal: controller.signal });
        const json = await res.json();
        if (ignore || !json.success) return;
        setProjects(
          (json.data as ProjectOption[]).map(({ id, name, status }) => ({ id, name, status }))
        );
      } catch {
        // Không tải được thì ô chọn ẩn đi — giao dịch vẫn ghi được, chỉ là
        // chưa gắn dự án. Đừng chặn cả form vì chuyện này.
      }
    })();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [refreshKey]);

  return projects;
}
