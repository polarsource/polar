/**
 * Shared parts of the metering film, ported from the brand repo (films/metering-video/src/scenes/kit.ts,
 * engine/dom.ts). Everything is a pure function of time, so the film scrubs and loops exactly.
 */

/** A CSS-style cubic bezier easing, 0..1 → 0..1, clamped. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by
  const X = (u: number) => ((ax * u + bx) * u + cx) * u
  const Y = (u: number) => ((ay * u + by) * u + cy) * u
  return (p: number) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    let u = p
    for (let i = 0; i < 8; i++) {
      const d = (3 * ax * u + 2 * bx) * u + cx
      if (Math.abs(d) < 1e-6) break
      u -= (X(u) - p) / d
    }
    return Y(Math.min(1, Math.max(0, u)))
  }
}

/** `glide` a long soft ease-out, `flow` an even ease-in-out, `snap` still, then across almost at once, then still. */
export const ease = {
  glide: bezier(0.22, 1, 0.36, 1),
  flow: bezier(0.65, 0, 0.35, 1),
  snap: bezier(0.96, 0, 0.04, 1),
}

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p

/** Deterministic hash of two integers to 0..1. */
export const hash2 = (a: number, b: number) => {
  let h =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(b + 0x632be5ab, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

/** Deterministic PRNG (mulberry32): never Math.random, so the film is the same every time. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  parent?.appendChild(node)
  return node
}

/** A canvas the size of the stage, laid over it. */
export function layer(parent: HTMLElement, W: number, H: number, cls = '') {
  const canvas = el('canvas', `absolute left-0 top-0 ${cls}`, parent)
  canvas.width = W
  canvas.height = H
  return { canvas, g: canvas.getContext('2d')! }
}

export type Rect = { x: number; y: number; w: number; h: number }
