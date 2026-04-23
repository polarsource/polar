"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * CycleArrow — a meander/serpentine pattern: vertical lines
 * connected by rounded semicircular caps at top and bottom.
 * Static, minimal.
 */

export const CycleArrow = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const styles = getComputedStyle(canvas);
    const strokeColor =
      styles.getPropertyValue("--color-graphic-stroke").trim() ||
      "rgb(190, 190, 190)";

    const cy = size / 2;
    const cols = 7;           // odd count so left and right end on opposite sides
    const colGap = size * 0.06; // horizontal spacing between verticals
    const halfH = size * 0.12;  // half the vertical extent
    const r = colGap / 2;      // semicircle radius = half the gap

    const totalW = (cols - 1) * colGap;
    const startX = (size - totalW) / 2;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();

    for (let i = 0; i < cols; i++) {
      const x = startX + i * colGap;
      const goingUp = i % 2 === 1;

      if (i === 0) {
        // Start at the bottom or top of the first column
        ctx.moveTo(x, goingUp ? cy + halfH : cy - halfH);
      }

      // Vertical line
      ctx.lineTo(x, goingUp ? cy - halfH : cy + halfH);

      // Semicircle connecting to the next column (if not last)
      if (i < cols - 1) {
        const arcCx = x + colGap / 2;
        const arcCy = goingUp ? cy - halfH : cy + halfH;
        ctx.arc(arcCx, arcCy, r, Math.PI, 0, !goingUp);
      }
    }

    ctx.stroke();
  }, []);

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  );
};
