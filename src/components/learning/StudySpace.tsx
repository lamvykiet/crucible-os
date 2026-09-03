"use client";

import { useState, useEffect, useRef } from "react";
import { backdropCss } from "@/lib/studySpace";

interface Pref {
  background: string | null;
  weatherEffect: string;
  contentAlign: string;
}

/**
 * Hạt cho lớp thời tiết.
 *
 * Mỗi hiệu ứng chỉ khác nhau ở tốc độ, kích thước và cách vẽ — nên dùng chung
 * một vòng lặp thay vì viết năm vòng lặp gần giống nhau.
 */
interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  alpha: number;
}

const COUNTS: Record<string, number> = {
  snow: 70, rain: 110, petals: 34, fog: 16, sunrays: 0,
};

/**
 * Lớp phủ thời tiết, vẽ bằng canvas.
 *
 * Không dùng ảnh động: nhẹ hơn, và tự tắt khi hệ thống báo người dùng muốn giảm
 * chuyển động — hiệu ứng nền chạy liên tục là thứ gây khó chịu nhất với người
 * nhạy cảm chuyển động, mà đây lại là màn hình người ta ngồi hàng giờ.
 */
function WeatherLayer({ effect }: { effect: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (effect === "none" || effect === "sunrays") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = COUNTS[effect] ?? 0;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size:
          effect === "rain" ? 8 + Math.random() * 10
          : effect === "fog" ? 120 + Math.random() * 160
          : 2 + Math.random() * 4,
        speedY:
          effect === "rain" ? 6 + Math.random() * 5
          : effect === "fog" ? 0.15 + Math.random() * 0.2
          : 0.5 + Math.random() * 1.1,
        speedX: effect === "petals" ? -0.6 + Math.random() * 1.2 : (Math.random() - 0.5) * 0.4,
        alpha: effect === "fog" ? 0.05 + Math.random() * 0.06 : 0.25 + Math.random() * 0.45,
      }));
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = effect === "petals" ? "#E8A0B4" : "#FFFFFF";
        ctx.strokeStyle = "#CFE3F5";

        if (effect === "rain") {
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX * 2, p.y + p.size);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        p.y += p.speedY;
        p.x += p.speedX;

        // Ra khỏi khung thì thả lại từ trên xuống.
        if (p.y > canvas.height + p.size) {
          p.y = -p.size;
          p.x = Math.random() * canvas.width;
        }
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.x < -p.size) p.x = canvas.width + p.size;
      }

      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [effect]);

  if (effect === "none") return null;

  // Nắng xuyên là vệt sáng tĩnh, không cần vẽ từng khung hình.
  if (effect === "sunrays") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, transparent 20%, rgba(255,240,200,.22) 32%, transparent 40%, transparent 56%, rgba(255,240,200,.16) 66%, transparent 74%)",
        }}
      />
    );
  }

  return (
    <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 w-full h-full" />
  );
}

/**
 * Khung không gian học.
 *
 * Bọc quanh nội dung Learning Hub và áp nền, hiệu ứng, căn lề mà người dùng đã
 * chọn. Chưa chọn gì thì không dựng thêm lớp nào — trang giữ nguyên như cũ.
 */
export default function StudySpace({ children }: { children: React.ReactNode }) {
  const [pref, setPref] = useState<Pref | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/learning/prefs", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!controller.signal.aborted && json?.success) setPref(json.pref);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const background = backdropCss(pref?.background);
  const effect = pref?.weatherEffect ?? "none";
  const alignLeft = pref?.contentAlign === "left";

  if (!background && effect === "none" && !alignLeft) return <>{children}</>;

  return (
    <div className="relative -mx-4 md:-mx-8 px-4 md:px-8 py-6 rounded-3xl overflow-hidden" style={background ? { background } : undefined}>
      <WeatherLayer effect={effect} />
      {/* Lớp mờ để chữ luôn đọc được, dù nền sáng hay tối. */}
      {background && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "color-mix(in srgb, var(--color-bg) 72%, transparent)" }}
        />
      )}
      <div className={`relative ${alignLeft ? "" : "mx-auto"}`}>{children}</div>
    </div>
  );
}
