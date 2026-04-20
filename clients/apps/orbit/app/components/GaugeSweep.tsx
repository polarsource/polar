"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * GaugeSweep — a ring of short tick marks like a measurement gauge.
 * A bright sweep travels around the circle, lighting up ticks
 * sequentially with a bezier ease per tick. Faint background ticks
 * always visible. Minimal, quantification aesthetic for metering.
 */

const TICK_COUNT = 48;
const INNER_R_FRAC = 0.22;
const OUTER_R_FRAC = 0.32;

// Cubic ease-out
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const GaugeSweep = () => {
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
    const innerR = size * INNER_R_FRAC;
    const outerR = size * OUTER_R_FRAC;

    // Every 4th tick is longer (major tick)
    const majorInnerR = size * (INNER_R_FRAC - 0.04);

    // Timing
    const TICK_INTERVAL = 0.04;
    const GLOW_DURATION = 0.5;
    const FULL_CYCLE =
      (TICK_COUNT - 1) * TICK_INTERVAL + GLOW_DURATION;

    let lastTime: number | null = null;
    let time = 0;

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      time += dt;

      ctx.clearRect(0, 0, size, size);

      const cycleTime = time % FULL_CYCLE;

      for (let i = 0; i < TICK_COUNT; i++) {
        const angle = (i / TICK_COUNT) * Math.PI * 2 - Math.PI / 2;
        const isMajor = i % 4 === 0;
        const iR = isMajor ? majorInnerR : innerR;

        const x1 = cx + Math.cos(angle) * iR;
        const y1 = cy + Math.sin(angle) * iR;
        const x2 = cx + Math.cos(angle) * outerR;
        const y2 = cy + Math.sin(angle) * outerR;

        // Faint background tick
        ctx.strokeStyle = "rgb(70, 70, 70)";
        ctx.lineWidth = isMajor ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Bright sweep — each tick glows briefly as the sweep passes
        const tickStart = i * TICK_INTERVAL;
        const localT = (cycleTime - tickStart) / GLOW_DURATION;
        const brightness = localT >= 0 && localT <= 1
          ? 1 - easeOut(Math.min(1, localT))
          : 0;

        if (brightness > 0.01) {
          const gray = Math.round(70 + brightness * 120);
          ctx.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`;
          ctx.lineWidth = isMajor ? 2 : 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // Center dot
      ctx.fillStyle = "rgb(190, 190, 190)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();

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
