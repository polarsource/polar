"use client";

import { useEffect, useRef } from "react";

export const SolarBurst = () => {
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

    const rayCount = 80;
    const innerR = size * 0.13;
    const rayLength = size * 0.30;

    // How many sawtooth cycles repeat around the full circle
    const cycles = 8;
    const sectionSize = (Math.PI * 2) / cycles;

    let angle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      const step = (Math.PI * 2) / rayCount;

      for (let i = 0; i < rayCount; i++) {
        const a = angle + i * step;

        // Sawtooth: linear ramp 0→1 within each section, hard reset at boundary
        const t = ((a % sectionSize) + sectionSize) % sectionSize / sectionSize;
        const opacity = 0.08 + t * 0.92;

        const x1 = cx + Math.cos(a) * innerR;
        const y1 = cy + Math.sin(a) * innerR;
        const x2 = cx + Math.cos(a) * (innerR + rayLength);
        const y2 = cy + Math.sin(a) * (innerR + rayLength);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(215, 215, 215, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Center circle masks inner ray ends
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0a0a";
      ctx.fill();

      angle += 0.0012;
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
