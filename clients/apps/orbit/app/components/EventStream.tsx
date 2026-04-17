"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * EventStream — 0s and 1s spawn at the center of a circular chamber
 * and push each other apart via the same mass-weighted, cubic-eased,
 * minimum-gap physics as MagneticBubbles. Brownian drift keeps the
 * cluster alive; a gentle center pull keeps it cohesive.
 */

const CHARS = "01";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
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
    const mono =
      getComputedStyle(canvas).getPropertyValue("--font-mono").trim() ||
      "monospace";
    ctx.font = `${fontSize}px ${mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Each character acts as a bubble with this collision radius
    const charR = fontSize * 0.5;

    // Chamber
    const cCx = size * 0.5;
    const cCy = size * 0.5;
    const cR = size * 0.38;

    const spawnJitter = size * 0.15;

    const particles: Particle[] = [];
    const MAX_PARTICLES = 200;
    const LIFESPAN = 600;
    const SPAWN_EVERY = 3;

    // Physics — ported from MagneticBubbles
    const DAMPING = 0.96;
    const CENTER_PULL = 0.0002;
    const REPEL_STRENGTH = 0.4;
    const DRIFT_STRENGTH = 0.25;
    const MIN_GAP = size * 0.02;

    let frame = 0;
    let lastTime: number | null = null;

    const spawn = () => {
      particles.push({
        x: cCx + (Math.random() - 0.5) * spawnJitter,
        y: cCy + (Math.random() - 0.5) * spawnJitter,
        vx: 0,
        vy: 0,
        r: charR,
        ch: CHARS[Math.floor(Math.random() * CHARS.length)],
        age: 0,
      });
    };

    const draw = (now: number) => {
      const dt =
        lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, size, size);

      frame++;
      if (frame % SPAWN_EVERY === 0 && particles.length < MAX_PARTICLES) {
        spawn();
      }

      // Remove dead particles
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].age > LIFESPAN) particles.splice(i, 1);
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        a.age++;

        // Brownian drift
        a.vx += (Math.random() - 0.5) * DRIFT_STRENGTH;
        a.vy += (Math.random() - 0.5) * DRIFT_STRENGTH;

        // Gentle center pull
        a.vx += (cCx - a.x) * CENTER_PULL;
        a.vy += (cCy - a.y) * CENTER_PULL;

        // Pairwise repulsion — mass-weighted, cubic-eased, with min gap
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const rx = a.x - b.x;
          const ry = a.y - b.y;
          const d2 = rx * rx + ry * ry;
          const gappedDist = a.r + b.r + MIN_GAP;

          if (d2 < gappedDist * gappedDist * 4 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const nx = rx / d;
            const ny = ry / d;

            const t = 1 - d / (gappedDist * 2);
            const force = t * t * t * REPEL_STRENGTH;

            const mA = a.r * a.r;
            const mB = b.r * b.r;
            const total = mA + mB;
            a.vx += nx * force * (mB / total);
            a.vy += ny * force * (mB / total);
            b.vx -= nx * force * (mA / total);
            b.vy -= ny * force * (mA / total);

            // Hard separation — enforces minimum gap
            if (d < gappedDist) {
              const overlap = (gappedDist - d) * 0.4;
              a.x += nx * overlap * (mB / total);
              a.y += ny * overlap * (mB / total);
              b.x -= nx * overlap * (mA / total);
              b.y -= ny * overlap * (mA / total);
            }
          }
        }

        // Integrate
        a.x += a.vx * dt * 60;
        a.y += a.vy * dt * 60;
        a.vx *= DAMPING;
        a.vy *= DAMPING;

        // Circular chamber boundary
        const dxC = a.x - cCx;
        const dyC = a.y - cCy;
        const dC = Math.hypot(dxC, dyC);
        const maxDist = cR - a.r;
        if (dC > maxDist && maxDist > 0) {
          const nx = dxC / dC;
          const ny = dyC / dC;
          a.x = cCx + nx * maxDist;
          a.y = cCy + ny * maxDist;
          const radVel = a.vx * nx + a.vy * ny;
          if (radVel > 0) {
            a.vx -= radVel * nx;
            a.vy -= radVel * ny;
          }
        }
      }

      // Render
      ctx.fillStyle = "rgb(190, 190, 190)";
      for (const p of particles) {
        ctx.fillText(p.ch, p.x, p.y);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  );
};
