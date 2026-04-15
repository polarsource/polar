"use client";

import { useEffect, useRef } from "react";

interface Ring {
  radius: number;
  rayCount: number;
  rayLength: number;
  direction: 1 | -1;
  angle: number;
}

export const CircularBand = () => {
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

    const rings: Ring[] = [
      { radius: size * 0.06, rayCount: 12, rayLength: size * 0.10, direction: 1,  angle: 0 },
      { radius: size * 0.16, rayCount: 18, rayLength: size * 0.13, direction: -1, angle: 0 },
      { radius: size * 0.29, rayCount: 24, rayLength: size * 0.16, direction: 1,  angle: 0 },
      { radius: size * 0.45, rayCount: 30, rayLength: size * 0.20, direction: -1, angle: 0 },
      { radius: size * 0.65, rayCount: 36, rayLength: size * 0.50, direction: 1,  angle: 0 },
    ];

    const speed = 0.0015;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      for (const ring of rings) {
        ring.angle += speed * ring.direction;

        const step = (Math.PI * 2) / ring.rayCount;

        for (let i = 0; i < ring.rayCount; i++) {
          const a = ring.angle + i * step;
          const x1 = cx + Math.cos(a) * ring.radius;
          const y1 = cy + Math.sin(a) * ring.radius;
          const x2 = cx + Math.cos(a) * (ring.radius + ring.rayLength);
          const y2 = cy + Math.sin(a) * (ring.radius + ring.rayLength);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = "rgba(220, 220, 220, 0.85)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

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
