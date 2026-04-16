"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number) =>
  Math.max(Math.abs(x) - hx, Math.abs(y) - hy, Math.abs(z) - hz);

// --- Metaballs ---
// Each ball's center drifts along a Lissajous-like path so the whole
// blob mass flows and merges organically over time.
interface Ball {
  r: number;          // effective radius
  ax: number; ay: number; az: number; // path amplitudes
  fx: number; fy: number; fz: number; // path frequencies
  px: number; py: number; pz: number; // phase offsets
}

const BALLS: Ball[] = [
  { r: 0.38, ax: 0.62, ay: 0.55, az: 0.68, fx: 0.30, fy: 0.45, fz: 0.38, px: 0.0, py: 1.1, pz: 2.2 },
  { r: 0.35, ax: 0.70, ay: 0.60, az: 0.55, fx: 0.45, fy: 0.28, fz: 0.50, px: 1.7, py: 0.4, pz: 3.0 },
  { r: 0.36, ax: 0.55, ay: 0.70, az: 0.50, fx: 0.38, fy: 0.52, fz: 0.31, px: 3.2, py: 2.7, pz: 0.5 },
  { r: 0.33, ax: 0.65, ay: 0.50, az: 0.65, fx: 0.55, fy: 0.34, fz: 0.44, px: 2.1, py: 3.8, pz: 1.3 },
];

// Scalar field: metaball blob intersected with a hard box.
//   metaSum  = Σ r² / d²  — classical inverse-squared metaball kernel.
//   metaSdf  = 1 − metaSum; negative where the ball contributions exceed 1.
//   boxSdf   clips the blob to a strict rectangular volume.
const field = (x: number, y: number, z: number, t: number) => {
  let metaSum = 0;
  for (const b of BALLS) {
    const cx = Math.sin(t * b.fx + b.px) * b.ax;
    const cy = Math.sin(t * b.fy + b.py) * b.ay;
    const cz = Math.sin(t * b.fz + b.pz) * b.az;
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const d2 = dx * dx + dy * dy + dz * dz + 1e-4;
    metaSum += (b.r * b.r) / d2;
  }
  const metaSdf = 1 - metaSum;
  const boxSdf = box(x, y, z, 0.55, 0.55, 0.7);
  return Math.max(metaSdf, boxSdf);
};

// Marching-squares contour edges (line segments per case).
// Corner order: 0=BL, 1=BR, 2=TR, 3=TL. Edges: 0=bottom,1=right,2=top,3=left.
const MS_EDGES: number[][] = [
  [], [0, 3], [0, 1], [1, 3], [1, 2], [0, 3, 1, 2], [0, 2], [2, 3],
  [2, 3], [0, 2], [0, 1, 2, 3], [1, 2], [1, 3], [0, 1], [0, 3], [],
];

// Filled-inside polygons. Each case = one or two polygons; indices 0-3 are
// corners (BL, BR, TR, TL), 4-7 are edges (bottom, right, top, left).
const MS_FILLS: number[][][] = [
  [], [[0, 4, 7]], [[1, 5, 4]], [[0, 1, 5, 7]], [[2, 6, 5]],
  [[0, 4, 7], [2, 6, 5]], [[4, 1, 2, 6]], [[0, 1, 2, 6, 7]],
  [[3, 7, 6]], [[0, 4, 6, 3]], [[1, 5, 4], [3, 7, 6]],
  [[0, 1, 5, 6, 3]], [[7, 3, 2, 5]], [[0, 4, 5, 2, 3]],
  [[7, 3, 2, 1, 4]], [[0, 1, 2, 3]],
];

const interp = (a: number, b: number) => (a === b ? 0.5 : a / (a - b));

export const VolumetricSlices = () => {
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
    ctx.lineJoin = "round";

    const gridN = 36;
    const sliceCount = 24;
    // Sample region slightly larger than the bounding box so MS captures
    // wall contours where the blob presses against it
    const xMin = -0.62, xMax = 0.62;
    const yMin = -0.62, yMax = 0.62;
    const zMin = -0.78, zMax = 0.78;
    const cellSizeX = (xMax - xMin) / gridN;
    const cellSizeY = (yMax - yMin) / gridN;

    const fieldCorners = new Float32Array((gridN + 1) * (gridN + 1));

    // Proper isometric projection: yaw 45°, pitch ≈ -35.26° (atan(1/√2))
    const yaw = Math.PI / 4;
    const pitch = -Math.atan(Math.SQRT1_2);
    const cY = Math.cos(yaw), sY = Math.sin(yaw);
    const cP = Math.cos(pitch), sP = Math.sin(pitch);
    const scale = size * 0.32;

    const project = (x: number, y: number, z: number) => {
      const x1 = x * cY + y * sY;
      const y1 = -x * sY + y * cY;
      const y2 = y1 * cP - z * sP;
      return { sx: size / 2 + x1 * scale, sy: size / 2 - y2 * scale };
    };

    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Render slices back-to-front so front slices occlude.
      // With a downward-looking isometric view, lower z is farther away.
      for (let s = 0; s < sliceCount; s++) {
        const sliceT = s / (sliceCount - 1);
        const z = zMin + sliceT * (zMax - zMin);

        // Sample scalar field at every cell corner
        for (let j = 0; j <= gridN; j++) {
          const y = yMin + j * cellSizeY;
          for (let i = 0; i <= gridN; i++) {
            const x = xMin + i * cellSizeX;
            fieldCorners[j * (gridN + 1) + i] = field(x, y, z, time);
          }
        }

        const fillPath = new Path2D();
        const strokePath = new Path2D();

        for (let j = 0; j < gridN; j++) {
          for (let i = 0; i < gridN; i++) {
            const f00 = fieldCorners[j * (gridN + 1) + i];
            const f10 = fieldCorners[j * (gridN + 1) + i + 1];
            const f11 = fieldCorners[(j + 1) * (gridN + 1) + i + 1];
            const f01 = fieldCorners[(j + 1) * (gridN + 1) + i];

            const mask =
              (f00 < 0 ? 1 : 0) |
              (f10 < 0 ? 2 : 0) |
              (f11 < 0 ? 4 : 0) |
              (f01 < 0 ? 8 : 0);
            if (mask === 0) continue;

            const x0 = xMin + i * cellSizeX;
            const y0 = yMin + j * cellSizeY;
            const x1 = x0 + cellSizeX;
            const y1 = y0 + cellSizeY;

            // 8 candidate vertices: 4 corners + 4 edge-midpoints
            const verts = [
              project(x0, y0, z),
              project(x1, y0, z),
              project(x1, y1, z),
              project(x0, y1, z),
              project(x0 + interp(f00, f10) * cellSizeX, y0, z),
              project(x1, y0 + interp(f10, f11) * cellSizeY, z),
              project(x0 + interp(f01, f11) * cellSizeX, y1, z),
              project(x0, y0 + interp(f00, f01) * cellSizeY, z),
            ];

            // Inside fill polygons (one or two per saddle case)
            for (const poly of MS_FILLS[mask]) {
              fillPath.moveTo(verts[poly[0]].sx, verts[poly[0]].sy);
              for (let p = 1; p < poly.length; p++) {
                fillPath.lineTo(verts[poly[p]].sx, verts[poly[p]].sy);
              }
              fillPath.closePath();
            }

            // Contour outlines (skip fully-inside cells — they have no edge)
            if (mask !== 15) {
              const edges = MS_EDGES[mask];
              for (let e = 0; e < edges.length; e += 2) {
                const a = verts[edges[e] + 4];
                const b = verts[edges[e + 1] + 4];
                strokePath.moveTo(a.sx, a.sy);
                strokePath.lineTo(b.sx, b.sy);
              }
            }
          }
        }

        // Occlude deeper slices without showing a visible fill colour.
        // destination-out erases any pixels previously drawn under the
        // fill path, producing a transparent hole that the canvas
        // background shows through.
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "#000";
        ctx.fill(fillPath);
        ctx.restore();

        // Stroke the contour on top
        const alpha = 0.45 + sliceT * 0.5;
        ctx.strokeStyle = `rgba(220, 220, 220, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke(strokePath);
      }

      time += 0.025;
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
