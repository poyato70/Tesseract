/**
 * Loader do Tesseract: hipercubo 4D em arame girando nos planos XW e YZ,
 * projetado em 2D. Usado em toda execução (barra superior, botões, telas).
 */
import { useEffect, useRef } from "react";

const VERTS: number[][] = [];
for (let i = 0; i < 16; i++) VERTS.push([0, 1, 2, 3].map((b) => ((i >> b) & 1 ? 1 : -1)));
const EDGES: [number, number][] = [];
for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b))) EDGES.push([i, i | (1 << b)]);

function project(t: number, size: number) {
  const a = t * 0.9, c = t * 0.55;
  return VERTS.map(([x, y, z, w]) => {
    // XW
    const x1 = x * Math.cos(a) - w * Math.sin(a);
    const w1 = x * Math.sin(a) + w * Math.cos(a);
    // YZ
    const y1 = y * Math.cos(c) - z * Math.sin(c);
    const z1 = y * Math.sin(c) + z * Math.cos(c);
    const k4 = 2.6 / (3.2 - w1);
    const x2 = x1 * k4, y2 = y1 * k4, z2 = z1 * k4;
    const k3 = 2.4 / (3.6 - z2);
    const s = size * 0.2;
    return [size / 2 + x2 * k3 * s, size / 2 + y2 * k3 * s];
  });
}

export function TesseractLoader({ size = 22, label, className = "" }: { size?: number; label?: string; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const lines = Array.from(svg.querySelectorAll("line"));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      // movimento reduzido: gira devagar (é o único sinal de processamento), sem parar
      const p = project(((now - start) / 1000) * (reduced ? 0.35 : 1), size);
      EDGES.forEach(([i, j], k) => {
        const l = lines[k];
        l.setAttribute("x1", p[i][0].toFixed(2));
        l.setAttribute("y1", p[i][1].toFixed(2));
        l.setAttribute("x2", p[j][0].toFixed(2));
        l.setAttribute("y2", p[j][1].toFixed(2));
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);
  return (
    <span className={`tl ${className}`} role={label ? "status" : undefined}>
      <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {EDGES.map((_, k) => (
          <line key={k} className={k % 4 === 3 ? "tl-w" : undefined} />
        ))}
      </svg>
      {label && <span className="tl-label">{label}</span>}
    </span>
  );
}
