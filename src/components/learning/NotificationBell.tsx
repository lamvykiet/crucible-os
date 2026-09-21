"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Loader2, Flame, Timer, Info } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Note {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  href: string | null;
  read?: boolean;
}

const ICONS: Record<string, typeof Info> = {
  streak: Flame,
  challenge: Timer,
  info: Info,
  system: Info,
};

/**
 * Chuông thông báo.
 *
 * Phần lớn thông báo ở đây được sinh tại chỗ từ trạng thái thật — chuỗi sắp
 * đứt, thử thách sắp hết giờ — chứ không lưu xuống bảng. Chúng hết đúng sau
 * vài giờ, và một danh sách đầy thông báo cũ đã sai thì tệ hơn là không có.
 */
export default function NotificationBell() {
  const { t } = useLanguage();

  const [open, setOpen] = useState(false);
  const [live, setLive] = useState<Note[]>([]);
  const [stored, setStored] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/notifications", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (controller.signal.aborted || !json?.success) return;
        setLive(json.live ?? []);
        setStored(json.stored ?? []);
        setUnread(json.unread ?? 0);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  const openPanel = () => {
    setOpen((v) => !v);
    if (!open && stored.some((n) => !n.read)) {
      fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
      setStored((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(live.length);
    }
  };

  const all = [...live, ...stored];

  return (
    <div className="relative">
      <button
        onClick={openPanel}
        className="c-btn c-btn-secondary c-btn-icon relative"
        aria-label={t("Notifications", "Thông báo")}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[min(340px,calc(100vw-32px))] c-card c-elev-lg p-4 z-50 space-y-3">
            <p className="c-card-kicker">{t("Notifications", "Thông báo")}</p>

            {!loaded ? (
              <div className="flex justify-center py-4 text-[var(--color-text-muted)]">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : all.length === 0 ? (
              <p className="c-card-body">{t("Nothing right now.", "Chưa có gì.")}</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {all.map((n) => {
                  const Icon = ICONS[n.kind] ?? Info;
                  const inner = (
                    <div className="flex gap-2.5 rounded-xl p-2.5 bg-[var(--color-surface-2)]">
                      <Icon size={15} className="text-[var(--color-accent)] flex-none mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-bold text-sm leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{n.body}</p>
                        )}
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} onClick={() => setOpen(false)} className="block hover:opacity-80 transition-opacity">
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
