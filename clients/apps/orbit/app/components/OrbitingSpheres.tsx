"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * OrbitingSpheres — a large circle plus a stack of nested circles that
 * all share a common tangent point at the large circle's centre. Each
 * inner circle passes through the anchor and extends toward an orbiting
 * satellite dot. As the dot circles the big sphere, the whole stack
 * swings around the anchor.
 *
 * Geometry — given anchor A (= big circle's centre), direction D toward
 * the satellite, and inner-circle radius r:
 *   center = A + D · r      (so the circle passes through A)
 *
 * Each deeper circle shrinks by SHRINK, so all inner circles remain
 * internally tangent to the previous at A.
 */

// How much each nested circle shrinks relative to its parent
const SHRINK = 0.62;
// Recursion depth for the nested circles
const DEPTH = 5;

export const OrbitingSpheres = () => {
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
    const R = size * 0.28;

    // Orbit radius for the satellite (distance from large sphere centre)
    const orbitR = R + size * 0.05;
    // Satellite dot radius
    const satR = size * 0.015;

    let angle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Direction unit vector from big sphere's centre toward satellite
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      ctx.strokeStyle = "rgba(220, 220, 220, 0.85)";
      ctx.lineWidth = 1;

      // Big sphere
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Nested inner circles — all tangent at the big sphere's centre (cx, cy)
      // and extending in the direction of the satellite.
      let r = R * 0.5;
      for (let i = 0; i < DEPTH; i++) {
        ctx.beginPath();
        ctx.arc(cx + dx * r, cy + dy * r, r, 0, Math.PI * 2);
        ctx.stroke();
        r *= SHRINK;
      }

      // Satellite dot orbiting outside the big sphere
      const satX = cx + dx * orbitR;
      const satY = cy + dy * orbitR;
      ctx.beginPath();
      ctx.arc(satX, satY, satR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220, 220, 220, 0.95)";
      ctx.fill();

      angle += 0.004;
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
