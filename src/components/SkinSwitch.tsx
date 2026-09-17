"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Nút đổi qua lại giữa design system thật và hai lớp da thử nghiệm.
 *
 * Chỉ ghi một thuộc tính `data-skin` lên <html>; toàn bộ phần nhìn do
 * `src/app/origin-skin.css` và `src/app/steep-skin.css` lo. Không component
 * nào khác biết tới nó, nên gỡ bản thử đi chỉ là xoá file này, hai dòng import
 * CSS và một dòng trong MainLayoutWrapper.
 *
 * Cũng nhận `?skin=origin` / `?skin=steep` / `?skin=off` để mở thẳng bằng
 * đường dẫn (tiện khi cần chụp màn hình hoặc gửi link cho người khác xem).
 */

const SKIN_STORAGE_KEY = "app_skin_experiment";

/** Thứ tự bấm: bản thật → Origin → Steep → bản thật. */
const SKINS = ["off", "origin", "steep"] as const;
type Skin = (typeof SKINS)[number];

function isSkin(v: string | null): v is Skin {
  return v === "off" || v === "origin" || v === "steep";
}

function apply(skin: Skin) {
  if (skin === "off") delete document.documentElement.dataset.skin;
  else document.documentElement.dataset.skin = skin;
}

function remember(skin: Skin) {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin);
  } catch {
    // Chế độ riêng tư chặn localStorage — lựa chọn chỉ sống trong lần tải này.
  }
}

export default function SkinSwitch() {
  const { t } = useLanguage();
  const [skin, setSkin] = useState<Skin>("off");

  useEffect(() => {
    let next: Skin = "off";
    try {
      const stored = localStorage.getItem(SKIN_STORAGE_KEY);
      if (isSkin(stored)) next = stored;
    } catch {
      // Không đọc được thì coi như chưa chọn gì.
    }

    const fromUrl = new URLSearchParams(window.location.search).get("skin");
    if (isSkin(fromUrl)) {
      next = fromUrl;
      // Ghi luôn xuống localStorage: mở bằng ?skin=... rồi bấm sang trang khác
      // mà lại quay về bản thật thì không so sánh được gì.
      remember(next);
    }

    apply(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkin(next);
  }, []);

  const toggle = useCallback(() => {
    setSkin((prev) => {
      const next = SKINS[(SKINS.indexOf(prev) + 1) % SKINS.length];
      apply(next);
      remember(next);
      return next;
    });
  }, []);

  const label =
    skin === "origin" ? "Origin" : skin === "steep" ? "Steep" : "Crucible";

  return (
    <button
      type="button"
      onClick={toggle}
      className="o-skin-switch"
      title={t(
        "Experimental skins — cycle Crucible → Origin → Steep",
        "Lớp da thử nghiệm — bấm để đổi Crucible → Origin → Steep"
      )}
    >
      {label}
    </button>
  );
}
