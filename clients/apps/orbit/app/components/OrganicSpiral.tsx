"use client";

import { useEffect, useRef } from "react";

export const OrganicSpiral = () => {
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

    const ringCount = 14;
    const minR = size * 0.04;
    const maxR = size * 0.44;
    const spacing = (maxR - minR) / ringCount;

    // How much the center drifts per ring
    const driftX = size * 0.004;
    const driftY = size * 0.002;

    // Organic shape harmonics — fixed per ring, scaled by radius
    const harmonics = [
      { freq: 2, amp: 0.18, phase: 0.8 },
      { freq: 3, amp: 0.12, phase: 2.1 },
      { freq: 5, amp: 0.06, phase: 1.3 },
    ];

    let time = 0;

    const drawRing = (ringIndex: number) => {
      const r = minR + ringIndex * spacing;
      const ocx = cx + ringIndex * driftX;
      const ocy = cy + ringIndex * driftY;

      const steps = 256;
      ctx.beginPath();

      for (let j = 0; j <= steps; j++) {
        const theta = (j / steps) * Math.PI * 2;

        // Apply organic harmonics — amplitude scales with ring size
        let distortion = 0;
        for (const h of harmonics) {
          const pulse = Math.sin(time * (0.7 + h.freq * 0.3));
        distortion += Math.sin(h.freq * theta + h.phase) * h.amp * pulse * r;
        }

        const pr = r + distortion;
        const px = ocx + Math.cos(theta) * pr;
        const py = ocy + Math.sin(theta) * pr;

        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.closePath();
      ctx.strokeStyle = "rgba(220, 220, 220, 0.85)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      for (let i = 0; i < ringCount; i++) {
        drawRing(i);
      }

      time += 0.02;
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
