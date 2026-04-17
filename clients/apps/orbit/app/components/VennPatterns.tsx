"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * VennPatterns — three circles in a trefoil arrangement, slowly
 * rotating. Pairwise intersections show dot patterns in subtle gray;
 * the triple center is a solid fill.
 */

type PatternFn = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) => void;

// Pattern: dots
const dots: PatternFn = (ctx, cx, cy, size) => {
  const s = size * 0.5;
  const step = size * 0.018;
  for (let x = cx - s; x < cx + s; x += step) {
    for (let y = cy - s; y < cy + s; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.002, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// Triple intersection: solid fill
const solidFill: PatternFn = (ctx, cx, cy, size) => {
  ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
};

export const VennPatterns = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const size = canvas.offsetWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.22;
    const offset = size * 0.18;

    let lastTime: number | null = null;
    let angle = 0;
    const ANG_SPEED = 0.12;

    const circPath = (x: number, y: number, r: number) => {
      const p = new Path2D();
      p.arc(x, y, r, 0, Math.PI * 2);
      return p;
    };

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      angle += ANG_SPEED * dt;

      ctx.clearRect(0, 0, size, size);

      const centers = [0, 1, 2].map((i) => ({
        x: cx + Math.cos(angle + (i * Math.PI * 2) / 3) * offset,
        y: cy + Math.sin(angle + (i * Math.PI * 2) / 3) * offset,
      }));

      const paths = centers.map((c) => circPath(c.x, c.y, innerR));

      // Pairwise intersections — dot pattern in subtle gray
      const pairs: [number, number][] = [[0, 1], [1, 2], [0, 2]];
      for (const [a, b] of pairs) {
        ctx.save();
        ctx.clip(paths[a]);
        ctx.clip(paths[b]);
        ctx.fillStyle = "rgb(70, 70, 70)";
        dots(ctx, cx, cy, size);
        ctx.restore();
      }

      // Triple intersection — solid white fill
      ctx.save();
      ctx.clip(paths[0]);
      ctx.clip(paths[1]);
      ctx.clip(paths[2]);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "rgb(190, 190, 190)";
      solidFill(ctx, cx, cy, size);
      ctx.restore();

      // Stroke circles on top
      ctx.strokeStyle = "rgb(190, 190, 190)";
      ctx.lineWidth = 1;
      for (const p of paths) {
        ctx.stroke(p);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  );
};
