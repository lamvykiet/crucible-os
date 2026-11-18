"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Trình phát YouTube nhúng (IFrame Player API chính thức) với một việc riêng:
 * phát ĐÚNG MỘT CÂU — tua tới đầu câu, phát, tự dừng ở cuối câu — cho chép
 * chính tả và nói nhại.
 */

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: { videoId: string; playerVars?: Record<string, number | string>; events?: { onReady?: () => void } }
  ) => YTPlayer;
}
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function useYouTube(videoId: string) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    const mount = document.createElement("div");
    host.appendChild(mount);
    loadApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1, cc_load_policy: 0 },
        events: { onReady: () => !cancelled && setReady(true) },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // Trình phát chưa dựng xong thì không có gì để huỷ.
      }
      playerRef.current = null;
      host.innerHTML = "";
    };
  }, [videoId]);

  // Theo dõi thời điểm đang phát: tô câu đang nói và tự dừng cuối câu.
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const now = p.getCurrentTime();
      setTime(now);
      const d = p.getDuration();
      if (d > 0) setDuration(d);
      if (stopAtRef.current !== null && now >= stopAtRef.current) {
        stopAtRef.current = null;
        p.pauseVideo();
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [ready]);

  const playRange = useCallback((start: number, end: number | null, rate = 1) => {
    const p = playerRef.current;
    if (!p) return;
    p.setPlaybackRate(rate);
    p.seekTo(Math.max(0, start - 0.15), true);
    stopAtRef.current = end === null ? null : end + 0.25;
    p.playVideo();
  }, []);

  const pause = useCallback(() => {
    stopAtRef.current = null;
    playerRef.current?.pauseVideo();
  }, []);

  return { hostRef, ready, time, duration, playRange, pause };
}
