import { useEffect, useRef } from 'react';
import type { GraphManager } from '../GraphManager';

type LensingNode = { x: number; y: number; mass: number };

function displacePoint(x: number, y: number, masses: LensingNode[]) {
  const INFLUENCE_RADIUS = 260;
  const INFLUENCE_R2 = INFLUENCE_RADIUS * INFLUENCE_RADIUS;
  const SOFTENING = 80 * 80;
  const G = 1400;
  const MAX_DISPLACEMENT = 18;

  let dxTotal = 0;
  let dyTotal = 0;

  for (const m of masses) {
    const dx = m.x - x;
    const dy = m.y - y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1 || r2 > INFLUENCE_R2) continue;

    const r = Math.sqrt(r2);
    const strength = (G * m.mass) / (r2 + SOFTENING);
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

export function LensingGridBackground(props: { graphManagerRef: React.MutableRefObject<GraphManager | null> }) {
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
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.clearRect(0, 0, w, h);

      // Base background
      ctx.fillStyle = 'rgb(9, 10, 16)';
      ctx.fillRect(0, 0, w, h);

      const rawMasses = props.graphManagerRef.current?.getLensingNodes() || [];
      const masses = rawMasses
        .sort((a, b) => b.mass - a.mass)
        .slice(0, 40);

      const gridSpacing = 64;
      const sampleStep = 18;

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(120, 160, 255, 0.10)';

      // Vertical lines
      for (let gx = 0; gx <= w; gx += gridSpacing) {
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
        ctx.beginPath();
        for (let gx = 0; gx <= w; gx += sampleStep) {
          const p = displacePoint(gx, gy, masses);
          if (gx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Subtle glow around masses
      ctx.globalCompositeOperation = 'lighter';
      for (const m of masses) {
        const r = 90 + m.mass * 20;
        const grd = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        grd.addColorStop(0, 'rgba(80, 140, 255, 0.10)');
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

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

