const R = 21;
const C = 2 * Math.PI * R;

/** A circular progress gauge with a value in the center and a label beside it. */
export function Gauge({ pct, color, center, label, sub }: {
  pct: number; color: string; center: string; label: string; sub: string;
}) {
  const off = C - (Math.max(0, Math.min(100, pct)) / 100) * C;
  return (
    <div className="flex items-center gap-3">
      <div className="gauge">
        <svg width="54" height="54">
          <circle cx="27" cy="27" r={R} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="5" />
          <circle cx="27" cy="27" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={off} />
        </svg>
        <span className="lbl" style={{ color }}>{center}</span>
      </div>
      <div>
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <div className="text-[11px] text-mut">{sub}</div>
      </div>
    </div>
  );
}
