"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

/**
 * Nút bật/tắt lớp da thử nghiệm "Origin".
 *
 * Chỉ ghi một thuộc tính `data-skin` lên <html>; toàn bộ phần nhìn do
 * `src/app/origin-skin.css` lo. Không component nào khác biết tới nó, nên gỡ
 * bản thử đi chỉ là xoá file này, dòng import CSS và một dòng trong
 * MainLayoutWrapper.
 *
 * Cũng nhận `?skin=origin` / `?skin=off` để mở thẳng bằng đường dẫn (tiện khi
 * cần chụp màn hình hoặc gửi link cho người khác xem).
 */

const SKIN_STORAGE_KEY = "app_skin_experiment";

export default function SkinSwitch() {
  const { t } = useLanguage();
  const [on, setOn] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("skin");
    let next = false;
    try {
      next = localStorage.getItem(SKIN_STORAGE_KEY) === "origin";
    } catch {
      // Chế độ riêng tư chặn localStorage — vẫn phải bật được bằng URL.
    }
    if (fromUrl === "origin" || fromUrl === "off") {
      next = fromUrl === "origin";
      // Ghi luôn xuống localStorage: mở bằng ?skin=origin rồi bấm sang trang
      // khác mà lại quay về bảng nâu thì không so sánh được gì.
      try {
        localStorage.setItem(SKIN_STORAGE_KEY, fromUrl);
      } catch {
        // Không lưu được thì lựa chọn chỉ sống trong lần tải trang này.
      }
    }

    if (next) document.documentElement.dataset.skin = "origin";
    else delete document.documentElement.dataset.skin;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(next);
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      if (next) document.documentElement.dataset.skin = "origin";
      else delete document.documentElement.dataset.skin;
      try {
        localStorage.setItem(SKIN_STORAGE_KEY, next ? "origin" : "off");
      } catch {
        // Không lưu được thì thôi, phiên này vẫn đổi.
      }
      return next;
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className="o-skin-switch"
      title={t(
        "Experimental skin — toggle between the Crucible palette and Origin Financial",
        "Lớp da thử nghiệm — đổi qua lại giữa bảng màu Crucible và Origin Financial"
      )}
    >
      {on ? t("Origin", "Origin") : t("Crucible", "Crucible")}
    </button>
  );
}
