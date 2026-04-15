"use client";

import { useEffect, useRef } from "react";

export const WaveSphere = () => {
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
    const radius = size * 0.38;

    // Number of horizontal lines
    const lineCount = 36;
    const lineSpacing = (radius * 2) / (lineCount + 1);

    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Clip everything to the sphere boundary
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      for (let i = 0; i <= lineCount; i++) {
        const baseY = cy - radius + (i + 1) * lineSpacing;

        // Normalised vertical position [-1, 1]
        const ny = (baseY - cy) / radius;

        // Wave amplitude — full in the middle, tapers toward poles
        const amp = size * 0.045 * Math.sqrt(Math.max(0, 1 - ny * ny));

        // Phase shifts linearly with vertical position → creates the S-twist
        const phaseShift = ny * Math.PI * 2.5;

        ctx.beginPath();

        for (let px = cx - radius; px <= cx + radius; px += 1.5) {
          const nx = (px - cx) / radius;
          // Squeeze wave frequency toward edges (longitude compression)
          const waveY = baseY + amp * Math.sin((nx * Math.PI) + phaseShift + time);

          if (px === cx - radius) {
            ctx.moveTo(px, waveY);
          } else {
            ctx.lineTo(px, waveY);
          }
        }

        // Opacity slightly brighter near center lines
        const opacity = 0.4 + 0.55 * (1 - Math.abs(ny));
        ctx.strokeStyle = `rgba(220, 220, 220, ${opacity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.restore();

      time += 0.008;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="aspect-square w-full rounded-sm bg-neutral-950"
    />
  );
};
