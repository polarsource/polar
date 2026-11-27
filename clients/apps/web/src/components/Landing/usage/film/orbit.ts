import { rng } from './kit'
import { P } from './palette'

/**
 * The orbit's field, shared by the world and the curtain: hundreds of usage events, small squares, each on its own
 * ring round the middle of the frame, the inner rings turning faster. (films/metering-video/src/scenes/orbit.ts)
 */

const N = 340

export type Particle = ReturnType<typeof makeField>[number]

/** How far the field has turned by `t` (seconds into the film): a constant turn, never speeding up. */
export const SPIN = 0.8
export const turn = (t: number) => SPIN * t

/** The field, the same every time it is made. */
export function makeField(revealAt = 0, paleFrom = Infinity) {
  const r = rng(41)
  return Array.from({ length: N }, () => {
    const R = 120 + Math.pow(r(), 0.8) * 860
    const kind = r()
    return {
      R,
      k: 0.62 + r() * 0.12,
      a0: r() * Math.PI * 2,
      s: 1.5 - R / 1100 + (r() - 0.5) * 0.25,
      size: 5 + Math.floor(r() * 3) * 3,
      ink:
        kind < 0.07
          ? P.ether
          : kind < 0.55
            ? P.ink
            : kind < 0.85
              ? P.stone
              : P.faint,
      pale: kind < 0.55 ? P.paleInk : P.paleStone,
      blob: r() < 0.08,
      born: revealAt + Math.pow(r(), 1.6) * 0.4,
      paleAt: paleFrom + r() * 0.45,
    }
  })
}

/** Where an event of the field is at `t`. */
export function fieldAt(p: Particle, t: number, cx: number, cy: number) {
  const a = p.a0 + turn(t) * p.s
  return [cx + p.R * Math.cos(a), cy + p.R * p.k * Math.sin(a)] as const
}
