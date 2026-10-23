"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Loader2, Pencil, UserPlus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useHealth } from "@/components/health/HealthContext";
import ProfileModal from "@/components/health/ProfileModal";
import type { HealthProfile } from "@/components/health/types";

/**
 * Khung chung của ba màn Sức khoẻ: nút hành động và thanh chọn người. Tên
 * function và dải chuyển màn nằm trên thanh trên (`src/lib/modules.tsx`). Chưa có ai thì cả màn chỉ còn một lời mời thêm người — mọi số đo đều
 * phải thuộc về một người cụ thể.
 */
export default function HealthShell({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  const { profiles, profile, selectProfile, error, reloadProfiles } = useHealth();
  const [editing, setEditing] = useState<HealthProfile | null | "new">(null);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-28">
      {/* Tên function và tab con nằm trên thanh trên + phông cảnh; ở đây chỉ
          còn nút hành động. */}
      {profile && actions && (
        <div className="flex flex-wrap justify-end gap-2 [&>.c-btn]:flex-1 sm:[&>.c-btn]:flex-none">{actions}</div>
      )}

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
