"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * ConcentricDraw — concentric circles whose strokes draw in
 * sequentially from inner to outer, each filling its circumference
 * with a bezier ease. Faint background rings are always visible.
 * Minimal, tier/level aesthetic for pricing.
 */

const RING_COUNT = 4;
const MIN_R_FRAC = 0.08;
const RING_STEP_FRAC = 0.08;

// Cubic ease-in-out
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const ConcentricDraw = () => {
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
    ctx.lineCap = "round";

    const cx = size / 2;
    const cy = size / 2;

    const radii = Array.from(
      { length: RING_COUNT },
      (_, i) => size * (MIN_R_FRAC + i * RING_STEP_FRAC),
    );

    // Timing
    const RING_INTERVAL = 0.25;
    const DRAW_DURATION = 2.8;
    const FULL_CYCLE =
      (RING_COUNT - 1) * RING_INTERVAL + DRAW_DURATION;

    let lastTime: number | null = null;
    let time = 0;

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      time += dt;

      ctx.clearRect(0, 0, size, size);

      const cycleTime = time % FULL_CYCLE;

      for (let i = 0; i < RING_COUNT; i++) {
        const r = radii[i];
        const circumference = 2 * Math.PI * r;

        // Faint background ring
        ctx.strokeStyle = "rgb(70, 70, 70)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Animated stroke — fills in from start, stays once complete
        const ringStart = i * RING_INTERVAL;

        const tipT = (cycleTime - ringStart) / DRAW_DURATION;
        const progress = ease(Math.max(0, Math.min(1, tipT)));

        if (progress <= 0) continue;

        const startAngle = -Math.PI / 2;
        const endAngle = -Math.PI / 2 + Math.PI * 2 * progress;

        if (endAngle - startAngle < 0.01) continue;

        ctx.strokeStyle = "rgb(190, 190, 190)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.stroke();
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
