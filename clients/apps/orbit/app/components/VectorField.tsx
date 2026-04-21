"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * VectorField — fixed-length line segments on a disk, oriented by a
 * polar-native vector field.
 *
 * For each sample point at polar (r, θ):
 *
 *   angle(r, θ, t) = n · θ + k · r − ω · t
 *
 * This is a rotating logarithmic-spiral / rose field: contour lines of
 * n·θ + k·r = const form n-armed spirals, and subtracting ω·t makes the
 * whole structure rotate continuously. The result has natural circular
 * symmetry — the arms curve outward from center to boundary and the
 * angular step n sets the number of spiral arms.
 */
export const VectorField = () => {
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

    const cols = 32;
    const rows = 32;

    const padding = size * 0.08;
    const innerSize = size - padding * 2;
    const cellW = innerSize / cols;
    const cellH = innerSize / rows;

    // Fixed line half-length — fits inside a cell
    const half = Math.min(cellW, cellH) * 0.42;

    let time = 0;

    // Pre-blended gray range — horizontal lines bright, vertical faded
    // (no alpha channel; colors match bg-dark-850 ≈ rgb(23,23,23))
    const MIN_GRAY = 47;   // vertical lines (was alpha 0.12)
    const MAX_GRAY = 190;  // horizontal lines (was alpha 0.85)

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.lineWidth = 1;
      ctx.lineCap = "round";

      for (let ci = 0; ci < cols; ci++) {
        for (let ri = 0; ri < rows; ri++) {
          // Normalised coords in [-1, 1]
          const u = ((ci + 0.5) / cols - 0.5) * 2;
          const v = ((ri + 0.5) / rows - 0.5) * 2;

          // Clip to a circular region
          const r = Math.hypot(u, v);
          if (r > 1) continue;

          // Rotating spiral/rose field
          const theta = Math.atan2(v, u);
          const n = 3;
          const k = 4;
          const omega = 0.6;
          const angle = n * theta + k * r - omega * time;

          const ca = Math.cos(angle);
          const sa = Math.sin(angle);
          const dx = ca * half;
          const dy = sa * half;

          // |cos(angle)| = 1 when horizontal, 0 when vertical
          const horizontalness = Math.abs(ca);
          const gray = Math.round(MIN_GRAY + horizontalness * (MAX_GRAY - MIN_GRAY));

          const cx = padding + cellW * (ci + 0.5);
          const cy = padding + cellH * (ri + 0.5);

          ctx.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`;
          ctx.beginPath();
          ctx.moveTo(cx - dx, cy - dy);
          ctx.lineTo(cx + dx, cy + dy);
          ctx.stroke();
        }
      }

      time += 0.02;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  );
};
