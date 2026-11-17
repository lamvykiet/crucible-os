"use client";

/**
 * Cột kiểu "Heart rate" của hệ Kính (docs/bieu-do.md mục 8): cột rộng bo tròn,
 * cột thường gạch chéo nhạt có viên số nổi, ĐÚNG MỘT cột nhấn tô đặc, đường tham
 * chiếu nét đứt có viên nhãn ở mép trái NGOÀI vùng cột, kỳ chưa trọn chỉ viền
 * đứt. Dưới 768px cuộn ngang trong thẻ (mỗi cột ≥ 60px).
 *
 * Chỉ VẼ: số và nhãn do nơi gọi tính. `v: null` = kỳ không có dữ liệu → cột thấp
 * và dấu "–" (không vẽ số 0 giả).
 */
export interface PillBar {
  key: string;
  /** Nhãn trục: "T6". */
  x: string;
  /** Dòng phụ dưới nhãn: "tới 17/11". */
  sx?: string;
  v: number | null;
  /** Số hiển thị trong viên: "14,1". */
  lab: string;
  accent?: boolean;
  partial?: boolean;
}

export default function PillBars({
  data,
  max,
  refLine,
  unit,
  height = 220,
  yTicks,
  ariaLabel,
}: {
  data: PillBar[];
  max: number;
  refLine?: { value: number; label: string };
  unit?: string;
  height?: number;
  yTicks?: { value: number; label: string }[];
  ariaLabel: string;
}) {
  const noY = !yTicks || yTicks.length === 0;
  const pct = (v: number) => Math.min(100, (v / (max || 1)) * 100);

  return (
    <div className="c-vbs">
      <div
        className={`c-vb ${noY ? "noy" : ""}`}
        style={{ ["--n" as string]: data.length, ["--h" as string]: `${height}px` }}
        role="img"
        aria-label={ariaLabel}
      >
        <div className="c-vb-plot">
          {!noY &&
            yTicks!.map((t) => (
              <span key={t.value} className="c-vb-yl" style={{ bottom: `${pct(t.value)}%` }}>
                {t.label}
              </span>
            ))}
          {refLine && (
            <>
              <i className="c-vb-ref" style={{ bottom: `${pct(refLine.value)}%` }} />
              <span className="c-vb-rl" style={{ bottom: `${pct(refLine.value)}%` }}>
                {refLine.label}
              </span>
            </>
          )}
          <div className="c-vb-cols">
            {data.map((d) => {
              if (d.v === null) {
                return (
                  <div key={d.key} className="c-vb-col">
                    <div className="c-vb-bar" style={{ height: "8%" }} />
                    <span className="c-vb-pill nil" style={{ bottom: "calc(8% - 8px)" }}>–</span>
                  </div>
                );
              }
              const h = Math.max(pct(d.v), 5);
              return (
                <div key={d.key} className="c-vb-col">
                  <div className={`c-vb-bar ${d.accent ? "acc" : ""} ${d.partial ? "part" : ""}`} style={{ height: `${h}%` }} />
                  <span className={`c-vb-pill ${d.accent ? "acc" : ""}`} style={{ bottom: `calc(${h}% - 10px)` }}>
                    <b>{d.lab}</b>
                    {unit && <span>{unit}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="c-vb-x" aria-hidden>
          {data.map((d) => (
            <span key={d.key} className={d.accent ? "on" : ""}>
              {d.x}
              {d.sx && <small>{d.sx}</small>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
