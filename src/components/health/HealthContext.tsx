"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { HealthProfile, Measurement, Workout } from "@/components/health/types";

interface HealthState {
  profiles: HealthProfile[] | null;
  profile: HealthProfile | null;
  selectProfile: (id: string) => void;
  /** Số đo của người đang chọn, cũ trước mới sau. null = đang tải. */
  measurements: Measurement[] | null;
  /** Buổi tập của người đang chọn, mới trước cũ sau. null = đang tải. */
  workouts: Workout[] | null;
  error: string | null;
  reloadProfiles: () => Promise<void>;
  reloadData: () => void;
}

const HealthContext = createContext<HealthState | null>(null);

const STORAGE_KEY = "health_profile";

/**
 * Nguồn dữ liệu chung cho ba màn của module Sức khoẻ.
 *
 * Người đang xem (chồng / vợ) phải đi theo khi chuyển màn — chọn "Vợ" ở Tổng
 * quan rồi bấm sang Buổi tập mà lại hiện của chồng là ghi nhầm người. Nên chọn
 * người nằm ở layout, không nằm ở từng trang.
 */
export function HealthProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<HealthProfile[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataTick, setDataTick] = useState(0);

  const reloadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/health/profiles");
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Không tải được danh sách người");
      setProfiles(json.profiles);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProfiles((p) => p ?? []);
    }
  }, []);

  useEffect(() => {
    // Lượt tải đầu khi mở module — setState nằm trong promise, không đồng bộ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadProfiles();
  }, [reloadProfiles]);

  // Người đang chọn: lựa chọn đã nhớ nếu còn tồn tại, không thì người đầu tiên.
  const profile = useMemo(() => {
    if (!profiles?.length) return null;
    let remembered: string | null = null;
    try {
      remembered = selectedId ?? localStorage.getItem(STORAGE_KEY);
    } catch {
      remembered = selectedId;
    }
    return profiles.find((p) => p.id === remembered) ?? profiles[0];
  }, [profiles, selectedId]);

  const selectProfile = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Chế độ riêng tư có thể chặn localStorage — vẫn chọn được trong phiên.
    }
  }, []);

  const profileId = profile?.id ?? null;

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeasurements(null);
    setWorkouts(null);
    Promise.all([
      fetch(`/api/health/measurements?profileId=${profileId}`).then((r) => r.json()),
      fetch(`/api/health/workouts?profileId=${profileId}`).then((r) => r.json()),
    ])
      .then(([m, w]) => {
        if (cancelled) return;
        if (!m?.success) throw new Error(m?.error || "Không tải được số đo");
        if (!w?.success) throw new Error(w?.error || "Không tải được buổi tập");
        setMeasurements(m.measurements);
        setWorkouts(w.workouts);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setMeasurements([]);
        setWorkouts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, dataTick]);

  const reloadData = useCallback(() => {
    setDataTick((n) => n + 1);
    // Ngày đo / buổi tập gần nhất trên thanh chọn người cũng đổi theo.
    reloadProfiles();
  }, [reloadProfiles]);

  return (
    <HealthContext.Provider
      value={{ profiles, profile, selectProfile, measurements, workouts, error, reloadProfiles, reloadData }}
    >
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth phải nằm trong <HealthProvider>");
  return ctx;
}
