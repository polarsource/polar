"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * EventStream — 0s and 1s flow in through a hole on the right side of
 * a central circular chamber, accumulate inside, and get squeezed out
 * through an equal-sized hole on the left under pairwise repulsion
 * "pressure". Pure canvas 2D.
 */

const CHARS = "01";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ch: string;
  age: number;
}

export const EventStream = () => {
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

    const fontSize = Math.max(8, size * 0.022);
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Collision radius — half-glyph-ish
    const radius = fontSize * 0.55;
    // Repellent distance — generous breathing room between digits
    const minDist = radius * 7.5;

    // Chamber — circle in the middle
    const cCx = size * 0.5;
    const cCy = size * 0.5;
    const cR = size * 0.3;


    // Entry — particles are born at the center of the chamber with a
    // small jitter. Pressure from pairwise repulsion pushes them
    // outward and they exit through the left hole.
    const entryX = cCx;
    const entryY = cCy;
    const spawnJitter = fontSize * 0.9;

    const particles: Particle[] = [];
    const MAX_PARTICLES = 260;
    const LIFESPAN = 600;
    const SPAWN_EVERY = 3;
    const DAMPING = 0.9;

    let frame = 0;

    // Spawn at the chamber center with small jitter; zero initial
    // velocity — pairwise repulsion pushes them apart naturally.
    const spawn = () => {
      particles.push({
        x: entryX + (Math.random() - 0.5) * spawnJitter,
        y: entryY + (Math.random() - 0.5) * spawnJitter,
        vx: 0,
        vy: 0,
        ch: CHARS[Math.floor(Math.random() * CHARS.length)],
        age: 0,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      frame++;
      if (frame % SPAWN_EVERY === 0 && particles.length < MAX_PARTICLES) {
        spawn();
      }

      // Remove particles that have aged out OR drifted far off-canvas
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.age > LIFESPAN || p.x < -fontSize * 2 || p.x > size + fontSize * 2 ||
            p.y < -fontSize * 2 || p.y > size + fontSize * 2) {
          particles.splice(i, 1);
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age++;

        // Pairwise repulsion — cubic-bezier-eased force so nearby
        // particles push each other apart with a smooth, organic feel.
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const rx = p.x - q.x;
          const ry = p.y - q.y;
          const d2 = rx * rx + ry * ry;
          if (d2 < minDist * minDist && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const nx = rx / d;
            const ny = ry / d;

            // Normalised closeness: 0 at edge of influence, 1 at overlap
            const t = 1 - d / minDist;
            // Cubic ease-in — gentle when far, strong when close
            const eased = t * t * t;
            const force = eased * 0.45;

            p.vx += nx * force;
            p.vy += ny * force;
            q.vx -= nx * force;
            q.vy -= ny * force;
          }
        }

        // Integrate
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= DAMPING;
        p.vy *= DAMPING;

        // Sealed circular chamber — any escape is pushed back to the wall
        const dxC = p.x - cCx;
        const dyC = p.y - cCy;
        const dC = Math.hypot(dxC, dyC);
        if (dC > cR) {
          const nx = dxC / dC;
          const ny = dyC / dC;
          p.x = cCx + nx * cR;
          p.y = cCy + ny * cR;
          const radVel = p.vx * nx + p.vy * ny;
          if (radVel > 0) {
            p.vx -= radVel * nx;
            p.vy -= radVel * ny;
          }
        }
      }

      // Render glyphs
      ctx.fillStyle = "rgba(230, 230, 230, 0.92)";
      for (const p of particles) {
        ctx.fillText(p.ch, p.x, p.y);
      }

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
