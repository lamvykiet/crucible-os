"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, Dumbbell, LayoutDashboard, Loader2, Pencil, Scale, UserPlus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useHealth } from "@/components/health/HealthContext";
import ProfileModal from "@/components/health/ProfileModal";
import type { HealthProfile } from "@/components/health/types";

/**
 * Khung chung của ba màn Sức khoẻ: tiêu đề, dải chuyển màn, và thanh chọn
 * người. Chưa có ai thì cả màn chỉ còn một lời mời thêm người — mọi số đo đều
 * phải thuộc về một người cụ thể.
 */
export default function HealthShell({
  title,
  lede,
  actions,
  children,
}: {
  title: string;
  lede: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { profiles, profile, selectProfile, error, reloadProfiles } = useHealth();
  const [editing, setEditing] = useState<HealthProfile | null | "new">(null);

  const tabs = [
    { href: "/health", icon: LayoutDashboard, label: t("Overview", "Tổng quan") },
    { href: "/health/body", icon: Scale, label: t("Body", "Cơ thể") },
    { href: "/health/workouts", icon: Dumbbell, label: t("Workouts", "Buổi tập") },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28">
      <header className="pt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="c-h2">{title}</h1>
          <p className="c-card-body">{lede}</p>
        </div>
        {profile && actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>

      <nav className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-1">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = href === "/health" ? pathname === "/health" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex-none inline-flex items-center gap-2 px-3.5 h-11 rounded-full text-sm font-semibold transition-colors ${
                active
                  ? "bg-[var(--glass-pill)] text-[var(--glass-pill-ink)] shadow-[0_6px_14px_-8px_rgba(40,30,20,.4)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="c-alert c-alert-error">
          <AlertCircle size={16} className="icon" />
          <span>{error}</span>
        </div>
      )}

      {profiles === null ? (
        <div className="c-card h-40 grid place-content-center text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <section className="c-card text-center py-10 flex flex-col items-center gap-3">
          <p className="c-card-body max-w-md">
            {t(
              "Add the people you track — each one keeps their own measurements and workouts.",
              "Thêm những người cần theo dõi — mỗi người có chuỗi số đo và buổi tập riêng."
            )}
          </p>
          <button type="button" onClick={() => setEditing("new")} className="c-btn c-btn-primary">
            <UserPlus size={16} /> {t("Add a person", "Thêm người")}
          </button>
        </section>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="c-seg flex-1 min-w-0 overflow-x-auto hide-scrollbar" role="tablist" aria-label={t("Person", "Người")}>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={p.id === profile?.id}
                  onClick={() => selectProfile(p.id)}
                  className={`c-seg-opt flex-1 min-w-0 truncate ${p.id === profile?.id ? "active" : ""}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {profile && (
              <button
                type="button"
                onClick={() => setEditing(profile)}
                aria-label={t("Edit person", "Sửa thông tin người")}
                className="c-btn c-btn-secondary c-btn-icon flex-none"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing("new")}
              aria-label={t("Add a person", "Thêm người")}
              className="c-btn c-btn-secondary c-btn-icon flex-none"
            >
              <UserPlus size={16} />
            </button>
          </div>
          {children}
        </>
      )}

      {editing !== null && (
        <ProfileModal
          profile={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (id) => {
            setEditing(null);
            await reloadProfiles();
            if (id) selectProfile(id);
          }}
        />
      )}
    </div>
  );
}
