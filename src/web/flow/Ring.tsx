import type { ReactNode } from "react";

/** Anel de progresso (preferência por status circular em vez de rótulos). */
export function Ring({ done, total, size = 44, label, stroke = 4 }: { done: number; total: number; size?: number; label?: ReactNode; stroke?: number }) {
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = total ? Math.min(1, done / total) : 0;
  return (
    <span className={`lx-ring${total && done >= total ? " is-complete" : ""}`} style={{ width: size, height: size }} role="img" aria-label={`${done} de ${total}`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="lx-ring-track" style={{ strokeWidth: stroke }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="lx-ring-value"
          style={{ strokeWidth: stroke }}
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span>{label ?? `${done}/${total}`}</span>
    </span>
  );
}
