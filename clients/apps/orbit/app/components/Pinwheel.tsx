"use client";

import { useEffect, useRef } from "react";

export const Pinwheel = () => {
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

    // Outer circle radius where petal tips land
    const R = size * 0.28;

    // Number of petals
    const petalCount = 20;

    // 8 rays = 4 crossing lines
    const spokeCount = 8;

    let angle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      ctx.strokeStyle = "rgba(220, 215, 205, 0.75)";
      ctx.lineWidth = 0.8;

      // --- Axis spokes with endpoint dots (static) ---
      for (let i = 0; i < spokeCount; i++) {
        const a = (i / spokeCount) * Math.PI * 2;
        const ex = cx + Math.cos(a) * R;
        const ey = cy + Math.sin(a) * R;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

      }

      // --- Petals ---
      // Each petal is a quadratic bezier from center → outer point,
      // with a control point offset perpendicular to the midpoint.
      for (let i = 0; i < petalCount; i++) {
        const a = angle + (i / petalCount) * Math.PI * 2;

        // Outer endpoint
        const ex = cx + Math.cos(a) * R;
        const ey = cy + Math.sin(a) * R;

        // Midpoint between center and outer point
        const mx = cx + Math.cos(a) * (R / 2);
        const my = cy + Math.sin(a) * (R / 2);

        // Perpendicular offset (rotated 90° clockwise) for the control point
        const perp = R * 0.55;
        const cpx = mx + Math.cos(a + Math.PI / 2) * perp;
        const cpy = my + Math.sin(a + Math.PI / 2) * perp;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.stroke();
      }

      angle += 0.003;
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
