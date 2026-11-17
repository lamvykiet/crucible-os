"use client";

import { useEffect, useState } from "react";

export interface Me {
  displayName: string | null;
  email: string | null;
}

// Một lần gọi cho cả phiên: Sidebar và thanh trên cùng cần tên người dùng.
let cache: Promise<Me | null> | null = null;

function loadMe(): Promise<Me | null> {
  cache ??= fetch("/api/me")
    .then((r) => r.json())
    .then((j) => (j?.success ? { displayName: j.displayName ?? null, email: j.email ?? null } : null))
    .catch(() => null);
  return cache;
}

/** Người đang đăng nhập (`/api/me`); `null` khi chưa tải xong hoặc lỗi. */
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    loadMe().then((v) => {
      if (alive) setMe(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return me;
}
