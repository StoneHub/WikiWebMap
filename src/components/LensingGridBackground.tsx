import { useEffect, useRef, type MutableRefObject } from 'react';
import type { GraphManager } from '../GraphManager';

type LensingNode = { x: number; y: number; mass: number };

// Single knob for the whole background effect.
// 0 = subtle/near-off, 1 = strong.
const EFFECT_INTENSITY = 2;

function displacePoint(x: number, y: number, masses: LensingNode[]) {
  const intensity = Math.min(1.5, Math.max(0, EFFECT_INTENSITY));

  const INFLUENCE_RADIUS = 440 * (0.7 + intensity * 0.7);
  const INFLUENCE_R2 = INFLUENCE_RADIUS * INFLUENCE_RADIUS;
  const SOFTENING = (55 * (1.35 - intensity * 0.55)) ** 2;
  const G = 3400 * (0.25 + intensity);
  const MAX_DISPLACEMENT = 26 * (0.25 + intensity);

  let dxTotal = 0;
  let dyTotal = 0;

  for (const m of masses) {
    const dx = m.x - x;
    const dy = m.y - y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1 || r2 > INFLUENCE_R2) continue;

    const r = Math.sqrt(r2);
    const falloff = 1 - r / INFLUENCE_RADIUS;
    const strength = ((G * m.mass) / (r2 + SOFTENING)) * falloff * falloff;
    dxTotal += (dx / r) * strength;
    dyTotal += (dy / r) * strength;
  }

  const mag = Math.sqrt(dxTotal * dxTotal + dyTotal * dyTotal);
  if (mag > MAX_DISPLACEMENT) {
    const s = MAX_DISPLACEMENT / mag;
    dxTotal *= s;
    dyTotal *= s;
  }

  return { x: x + dxTotal, y: y + dyTotal };
}

export function LensingGridBackground(props: { graphManagerRef: MutableRefObject<GraphManager | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    resize();

    const draw = () => {
      const intensity = Math.min(1.5, Math.max(0, EFFECT_INTENSITY));
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.clearRect(0, 0, w, h);

      const rawMasses = props.graphManagerRef.current?.getLensingNodes() || [];
      const masses = rawMasses
        .sort((a, b) => b.mass - a.mass)
        .slice(0, Math.max(10, Math.round(20 + 40 * intensity)));

      const gridSpacing = Math.max(40, Math.round(64 - 14 * intensity));
      const sampleStep = Math.max(10, Math.round(18 - 6 * intensity));

      ctx.lineWidth = 1;
      const minorAlpha = 0.03 + 0.07 * intensity;
      const majorAlpha = 0.06 + 0.14 * intensity;
      const minorStroke = `rgba(120, 160, 255, ${minorAlpha})`;
      const majorStroke = `rgba(120, 160, 255, ${majorAlpha})`;

      // Vertical lines
      for (let gx = 0; gx <= w; gx += gridSpacing) {
        const isMajor = (gx / gridSpacing) % 4 === 0;
        ctx.strokeStyle = isMajor ? majorStroke : minorStroke;
        ctx.beginPath();
        for (let gy = 0; gy <= h; gy += sampleStep) {
          const p = displacePoint(gx, gy, masses);
          if (gy === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Horizontal lines
      for (let gy = 0; gy <= h; gy += gridSpacing) {
        const isMajor = (gy / gridSpacing) % 4 === 0;
        ctx.strokeStyle = isMajor ? majorStroke : minorStroke;
        ctx.beginPath();
        for (let gx = 0; gx <= w; gx += sampleStep) {
          const p = displacePoint(gx, gy, masses);
          if (gx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Subtle bloom around strongest masses (kept very light to avoid "gas cloud")
      ctx.globalCompositeOperation = 'lighter';
      const bloomCount = Math.max(0, Math.round(4 + 8 * intensity));
      for (const m of masses.slice(0, bloomCount)) {
        const r = (50 + m.mass * 14) * (0.6 + intensity * 0.6);
        const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        const bloomAlpha = 0.01 + 0.06 * intensity;
        grd.addColorStop(0, `rgba(120, 170, 255, ${bloomAlpha})`);
        grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [props.graphManagerRef]);

  const opacity = Math.min(0.9, Math.max(0.2, 0.35 + EFFECT_INTENSITY * 0.55));
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity }}
    />
  );
}
