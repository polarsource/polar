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
    const cols = 5;
    const colGap = size * 0.08;
    const halfH = size * 0.16;
    const r = colGap / 2;

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
        ctx.moveTo(x, goingUp ? cy + halfH : cy - halfH);
      }

      ctx.lineTo(x, goingUp ? cy - halfH : cy + halfH);

      if (i < cols - 1) {
        const arcCx = x + colGap / 2;
        const arcCy = goingUp ? cy - halfH : cy + halfH;
        ctx.arc(arcCx, arcCy, r, Math.PI, 0, !goingUp);
      }
    }

    ctx.stroke();

    // Arrowheads — V-shaped strokes at both path ends
    const headLen = colGap * 0.8;
    const headAngle = Math.PI / 4;

    // Left end: path starts at top of first column, pointing down
    const lx = startX;
    const ly = cy - halfH;
    ctx.beginPath();
    ctx.moveTo(lx - Math.sin(headAngle) * headLen, ly + Math.cos(headAngle) * headLen);
    ctx.lineTo(lx, ly);
    ctx.lineTo(lx + Math.sin(headAngle) * headLen, ly + Math.cos(headAngle) * headLen);
    ctx.stroke();

    // Right end: path ends at bottom of last column, pointing up
    const rx = startX + (cols - 1) * colGap;
    const ry = cy + halfH;
    ctx.beginPath();
    ctx.moveTo(rx - Math.sin(headAngle) * headLen, ry - Math.cos(headAngle) * headLen);
    ctx.lineTo(rx, ry);
    ctx.lineTo(rx + Math.sin(headAngle) * headLen, ry - Math.cos(headAngle) * headLen);
    ctx.stroke();
  }, []);

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  );
};
