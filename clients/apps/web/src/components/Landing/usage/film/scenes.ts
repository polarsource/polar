import { ease, el, hash2, layer, lerp, rng, type Rect } from './kit'
import { fieldAt, makeField, turn } from './orbit'
import { P } from './palette'

/**
 * The metering film's two scenes, ported from the brand repo (films/metering-video/src/scenes/world.ts and
 * curtain.ts) with the sound cues taken out. Each draws as a pure function of scene time through `onFrame`.
 */

export interface SceneCtx {
  el: HTMLElement
  dur: number
  W: number
  H: number
  onFrame(fn: (t: number) => void): void
  /** The mono family as the page loaded it, for text drawn on canvas. */
  mono: string
}

/* ======================================================================================================
 * The world: the orbit's cloud of usage, its event chips riding it, and the panels: a square snapping round
 * the frame as a magnifying glass that decodes each chip into what it bills.
 * ==================================================================================================== */

type Tone = 'ink' | 'ether' | 'tint' | 'stone' | 'paper'
/** Each tone's colours for the canvas, and the same as Tailwind classes for the chip's element. */
const TONES: Record<Tone, [string, string, string]> = {
  ink: ['#E6E2D9', '#111111', 'bg-[#E6E2D9] text-[#111111]'],
  ether: ['#3619CC', '#FBFAF7', 'bg-[#3619CC] text-[#FBFAF7]'],
  tint: ['#CFC8F3', '#111111', 'bg-[#CFC8F3] text-[#111111]'],
  stone: ['#3A3833', '#E6E2D9', 'bg-[#3A3833] text-[#E6E2D9]'],
  paper: ['#262626', '#E6E2D9', 'bg-[#262626] text-[#E6E2D9]'],
}

export interface WorldScene {
  type: 'world'
  duration: number
  panels: Key[][]
  lens: [number, number][]
  ink: [number, number]
  fieldUntil: number
  tags: { text: string; tone: Tone; bill: string }[]
  spawn: { every: number; life: number }
  tagsDuring: [number, number]
}

const LENS = 1.5
/** A chip's type size and side padding, as its classes set them: the glass draws its decoded twin to match. */
const TAG = { size: 30, padX: 21 }
const WIPE = 0.3
const GROW = 1.3
/** How long the glass takes to morph from one rect to the next (the original film snaps in 0.34s). */
export const SNAP = 0.9
const lerpRect = (a: Rect, b: Rect, q: number): Rect => ({
  x: lerp(a.x, b.x, q),
  y: lerp(a.y, b.y, q),
  w: lerp(a.w, b.w, q),
  h: lerp(a.h, b.h, q),
})

export type Key = { at: number; rect: Rect; dur?: number }
export function panelAt(keys: Key[], t: number): Rect | undefined {
  let k = -1
  keys.forEach((key, i) => t >= key.at && (k = i))
  if (k < 0) return undefined
  const from = keys[Math.max(0, k - 1)].rect
  return lerpRect(
    from,
    keys[k].rect,
    ease.snap((t - keys[k].at) / (keys[k].dur ?? SNAP)),
  )
}

export function world(ctx: SceneCtx, cfg: WorldScene) {
  const { W, H, dur } = ctx
  const cx = W / 2,
    cy = H / 2
  const r = rng(42)
  const parts = makeField(-1)
  const inkOn = parts.map(() => cfg.ink[0] + r() * 0.45)
  const inkOff = parts.map(() => cfg.ink[1] + r() * 0.45)
  const lensOn = (t: number) => cfg.lens.some(([a, b]) => t >= a && t < b)

  const { g: gb } = layer(ctx.el, W, H)

  // the chips: spawned one after another, each on a ring of its own, riding the orbit for its life, then gone
  const [tFrom, tUntil] = cfg.tagsDuring
  const tags: {
    node: HTMLElement
    bill: string
    bg: string
    fg: string
    R: number
    k: number
    a0: number
    s: number
    born: number
    dies: number
    w: number
    h: number
    oh: number
  }[] = []
  for (
    let i = 0, at = tFrom;
    at < tUntil;
    i++, at += cfg.spawn.every * (0.75 + 0.5 * hash2(i, 5))
  ) {
    const tg = cfg.tags[(i * 5) % cfg.tags.length]
    const [bg, fg, tone] = TONES[tg.tone]
    const node = el(
      'div',
      `invisible absolute left-0 top-0 whitespace-nowrap px-[21px] py-[10px] font-mono text-[30px] font-normal uppercase leading-[1.2] tracking-[0.04em] ${tone}`,
      ctx.el,
      tg.text,
    )
    const life = cfg.spawn.life * (0.85 + 0.3 * hash2(i, 8))
    // of a few rings and places, the one whose path over its life runs into the chips alive with it least
    const w = tg.text.length * TAG.size * 0.6 * 1.04 + 2 * TAG.padX + 16,
      h = TAG.size * 1.2 + 20 + 16
    let best: { R: number; a0: number } | undefined,
      bestScore = Infinity
    for (let c = 0; c < 160 && bestScore > 0; c++) {
      const R = 130 + hash2(i * 37 + c, 7) * 720,
        a0 = hash2(i * 37 + c, 6) * Math.PI * 2,
        sp = 1.2 - R / 1300
      let score = 0
      for (let q = 0; q <= 16; q++) {
        const u = at + (life * q) / 16
        const ax = cx + R * Math.cos(a0 + turn(u) * sp),
          ay = cy + R * 0.66 * Math.sin(a0 + turn(u) * sp)
        for (const o of tags) {
          if (u < o.born || u >= o.dies) continue
          const ang = o.a0 + turn(u) * o.s,
            ox = cx + o.R * Math.cos(ang),
            oy = cy + o.R * o.k * Math.sin(ang)
          const dx = Math.max(0, (w + o.w) / 2 - Math.abs(ax - ox)),
            dy = Math.max(0, (h + o.h) / 2 - Math.abs(ay - oy))
          score += dx * dy
        }
      }
      if (score < bestScore) {
        bestScore = score
        best = { R, a0 }
      }
    }
    const { R, a0 } = best!
    tags.push({
      node,
      bill: tg.bill.toUpperCase(),
      bg,
      fg,
      R,
      k: 0.66,
      a0,
      s: 1.2 - R / 1300,
      born: at,
      dies: at + life,
      w,
      h,
      oh: 0,
    })
  }
  const alive = (tg: (typeof tags)[number], t: number) =>
    t >= tg.born && t < tg.dies
  const tagAt = (tg: (typeof tags)[number], spin: number) => {
    const a = tg.a0 + turn(spin) * tg.s
    return [cx + tg.R * Math.cos(a), cy + tg.R * tg.k * Math.sin(a)] as const
  }

  const { g: gf } = layer(ctx.el, W, H)

  ctx.onFrame((t) => {
    gb.clearRect(0, 0, W, H)
    gf.clearRect(0, 0, W, H)
    if (t >= dur - 0.02) return

    // the field, small, everywhere: pale, or ink while it is inked
    if (t < cfg.fieldUntil)
      parts.forEach((p, i) => {
        const [x, y] = fieldAt(p, t, cx, cy)
        gb.fillStyle = t >= inkOn[i] && t < inkOff[i] ? p.ink : p.pale
        gb.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size)
      })

    // the chips, riding their rings; each enters as a mask opening over it from its left edge
    for (const tg of tags) {
      const [x, y] = tagAt(tg, t)
      tg.node.style.visibility = alive(tg, t) ? 'visible' : 'hidden'
      const u = t - tg.born
      tg.node.style.clipPath =
        u < WIPE ? `inset(0 ${(1 - ease.flow(u / WIPE)) * 100}% 0 0)` : ''
      tg.node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    }

    // the panels: while a lens, the field and the chips behind seen through them, half again the size, decoded
    const lens = lensOn(t)
    for (const keys of cfg.panels) {
      const rc = panelAt(keys, t)
      if (!rc || rc.w < 0.5 || rc.h < 0.5) continue
      gf.save()
      gf.fillStyle = lens ? P.lens : P.card
      gf.fillRect(rc.x, rc.y, rc.w, rc.h)
      if (lens && t < cfg.fieldUntil) {
        gf.beginPath()
        gf.rect(rc.x, rc.y, rc.w, rc.h)
        gf.clip()
        for (const p of parts) {
          const [x, y] = fieldAt(p, t, cx, cy)
          const lx = cx + (x - cx) * LENS,
            ly = cy + (y - cy) * LENS,
            sz = p.size * GROW
          if (
            lx < rc.x - sz ||
            lx > rc.x + rc.w + sz ||
            ly < rc.y - sz ||
            ly > rc.y + rc.h + sz
          )
            continue
          gf.fillStyle = p.blob
            ? P.ether
            : p.ink === P.faint
              ? P.lensFaint
              : p.ink
          gf.fillRect(lx - sz / 2, ly - sz / 2, sz, sz)
        }
        gf.font = `400 ${TAG.size * LENS}px ${ctx.mono}`
        gf.letterSpacing = `${0.04 * TAG.size * LENS}px`
        gf.textBaseline = 'middle'
        for (const tg of tags) {
          if (!alive(tg, t)) continue
          tg.oh ||= tg.node.offsetHeight
          const th = tg.oh * LENS,
            tw = gf.measureText(tg.bill).width + 2 * TAG.padX * LENS
          const boxAt = (u: number) => {
            const gl = panelAt(keys, u)
            if (!gl || u < tg.born) return undefined
            const [x, y] = tagAt(tg, u)
            const lx = cx + (x - cx) * LENS,
              ly = cy + (y - cy) * LENS
            const over =
              lx + tw / 2 > gl.x &&
              lx - tw / 2 < gl.x + gl.w &&
              ly + th / 2 > gl.y &&
              ly - th / 2 < gl.y + gl.h
            return over ? { lx, ly } : undefined
          }
          const now = boxAt(t)
          if (!now) continue
          let since = 0
          while (since < WIPE && boxAt(t - since - 1 / 60)) since += 1 / 60
          const open = since >= WIPE ? 1 : ease.flow(since / WIPE)
          const x0 = now.lx - tw / 2,
            y0 = now.ly - th / 2
          gf.save()
          gf.beginPath()
          gf.rect(x0, y0, tw * open, th)
          gf.clip()
          gf.fillStyle = tg.bg
          gf.fillRect(x0, y0, tw, th)
          gf.fillStyle = tg.fg
          gf.fillText(tg.bill, x0 + TAG.padX * LENS, now.ly + LENS)
          gf.restore()
        }
        gf.letterSpacing = '0px'
      }
      gf.restore()
    }
  })
}

/* ======================================================================================================
 * The loop: over the film's last beats a curtain comes down with the film's first frame above its edge, so
 * when it reaches the bottom the film is back at its start, with no seam.
 * ==================================================================================================== */

export interface CurtainScene {
  type: 'curtain'
  duration: number
  /** When the curtain starts to come down; it reaches the bottom at the end of the scene. */
  at: number
}

export function curtain(ctx: SceneCtx, cfg: CurtainScene) {
  const { W, H, dur } = ctx
  const { g } = layer(ctx.el, W, H, 'z-[300]')
  const parts = makeField(-1)
  ctx.onFrame((t) => {
    g.clearRect(0, 0, W, H)
    if (t < cfg.at) return
    const edge =
      t >= dur - 1e-3 ? H : H * ease.snap((t - cfg.at) / (dur - cfg.at))
    if (edge <= 0) return
    g.save()
    g.beginPath()
    g.rect(0, 0, W, edge)
    g.clip()
    g.fillStyle = P.ground
    g.fillRect(0, 0, W, edge)
    // the field at the time it will have when the film starts again: counting up to zero
    const ft = t - dur
    for (const p of parts) {
      const [x, y] = fieldAt(p, ft, W / 2, H / 2)
      g.fillStyle = p.ink
      g.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size)
    }
    g.restore()
  })
}

export type Scene = { id: string; overlap?: number } & (
  | WorldScene
  | CurtainScene
)
export const builders = { world, curtain }
