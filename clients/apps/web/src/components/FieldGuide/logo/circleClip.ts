/**
 * Clips a closed path to a circle, the way the brand file builds the mark: the parts outside the circle
 * are dropped and the gaps closed along the circle itself. Lines are cut exactly, curves at a bisected
 * parameter. The result keeps the original vertices inside, puts anchors where the shape meets the circle,
 * and joins them with arcs of the circle. Absolute M L H V C Z only (what the brand files use).
 */
export interface Circle {
  cx: number
  cy: number
  r: number
}
type Pt = [number, number]
type Piece = { kind: 'L'; p: [Pt, Pt] } | { kind: 'C'; p: [Pt, Pt, Pt, Pt] }

const f = (v: number) => (Math.round(v * 1000) / 1000).toString()

function parse(d: string): Piece[][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
  const subs: Piece[][] = []
  let cur: Piece[] = []
  let cmd = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let i = 0
  const num = () => Number(tokens[i++])
  const line = (nx: number, ny: number) => {
    cur.push({
      kind: 'L',
      p: [
        [x, y],
        [nx, ny],
      ],
    })
    x = nx
    y = ny
  }
  while (i < tokens.length) {
    const t = tokens[i]
    if (/[a-zA-Z]/.test(t)) {
      cmd = t.toUpperCase()
      i++
      if (cmd === 'Z') {
        if (Math.hypot(sx - x, sy - y) > 1e-6) line(sx, sy)
        if (cur.length) subs.push(cur)
        cur = []
        continue
      }
    }
    switch (cmd) {
      case 'M':
        if (cur.length) subs.push(cur)
        cur = []
        x = sx = num()
        y = sy = num()
        cmd = 'L'
        break
      case 'L':
        line(num(), num())
        break
      case 'H':
        line(num(), y)
        break
      case 'V':
        line(x, num())
        break
      case 'C': {
        const p: [Pt, Pt, Pt, Pt] = [
          [x, y],
          [num(), num()],
          [num(), num()],
          [0, 0],
        ]
        p[3] = [num(), num()]
        cur.push({ kind: 'C', p })
        x = p[3][0]
        y = p[3][1]
        break
      }
      default:
        i++
    }
  }
  if (cur.length) subs.push(cur)
  return subs
}

const bez = (p: [Pt, Pt, Pt, Pt], t: number): Pt => {
  const u = 1 - t
  return [
    u * u * u * p[0][0] +
      3 * u * u * t * p[1][0] +
      3 * u * t * t * p[2][0] +
      t * t * t * p[3][0],
    u * u * u * p[0][1] +
      3 * u * u * t * p[1][1] +
      3 * u * t * t * p[2][1] +
      t * t * t * p[3][1],
  ]
}
/** De Casteljau split of a cubic at t. */
function splitC(
  p: [Pt, Pt, Pt, Pt],
  t: number,
): [[Pt, Pt, Pt, Pt], [Pt, Pt, Pt, Pt]] {
  const l = (a: Pt, b: Pt): Pt => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ]
  const p01 = l(p[0], p[1])
  const p12 = l(p[1], p[2])
  const p23 = l(p[2], p[3])
  const p012 = l(p01, p12)
  const p123 = l(p12, p23)
  const m = l(p012, p123)
  return [
    [p[0], p01, p012, m],
    [m, p123, p23, p[3]],
  ]
}

/** Parameters in (0, 1) where the piece crosses the circle, in order. */
function crossings(piece: Piece, c: Circle): number[] {
  const dist = (p: Pt) => Math.hypot(p[0] - c.cx, p[1] - c.cy) - c.r
  if (piece.kind === 'L') {
    const [a, b] = piece.p
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const fx = a[0] - c.cx
    const fy = a[1] - c.cy
    const A = dx * dx + dy * dy
    const B = 2 * (fx * dx + fy * dy)
    const C = fx * fx + fy * fy - c.r * c.r
    const disc = B * B - 4 * A * C
    if (disc <= 0 || A === 0) return []
    const s = Math.sqrt(disc)
    return [(-B - s) / (2 * A), (-B + s) / (2 * A)]
      .filter((t) => t > 1e-6 && t < 1 - 1e-6)
      .sort((p, q) => p - q)
  }
  const N = 96
  const out: number[] = []
  let prev = dist(bez(piece.p, 0))
  for (let k = 1; k <= N; k++) {
    const t = k / N
    const d = dist(bez(piece.p, t))
    if (prev < 0 !== d < 0) {
      let lo = (k - 1) / N
      let hi = t
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2
        if (dist(bez(piece.p, mid)) < 0 === prev < 0) lo = mid
        else hi = mid
      }
      out.push((lo + hi) / 2)
    }
    prev = d
  }
  return out
}

function cut(piece: Piece, t0: number, t1: number): Piece {
  if (piece.kind === 'L') {
    const [a, b] = piece.p
    const at = (t: number): Pt => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
    ]
    return { kind: 'L', p: [at(t0), at(t1)] }
  }
  // Split off [t0, 1], then take the first (t1 - t0) / (1 - t0) of it.
  const right = t0 > 0 ? splitC(piece.p, t0)[1] : piece.p
  const k = (t1 - t0) / (1 - t0)
  return { kind: 'C', p: k < 1 ? splitC(right, k)[0] : right }
}

export function clipToCircle(d: string, c: Circle): string {
  const inside = (p: Pt) => Math.hypot(p[0] - c.cx, p[1] - c.cy) <= c.r
  const start = (piece: Piece) => piece.p[0]
  const end = (piece: Piece) => piece.p[piece.p.length - 1] as Pt
  const out: string[] = []
  for (const sub of parse(d)) {
    // Cut every piece at its crossings and tag the parts.
    const parts: { piece: Piece; in: boolean }[] = []
    for (const piece of sub) {
      const ts = [0, ...crossings(piece, c), 1]
      for (let k = 0; k + 1 < ts.length; k++) {
        const part = cut(piece, ts[k], ts[k + 1])
        const mid =
          part.kind === 'L'
            ? ([
                (part.p[0][0] + part.p[1][0]) / 2,
                (part.p[0][1] + part.p[1][1]) / 2,
              ] as Pt)
            : bez(part.p, 0.5)
        parts.push({ piece: part, in: inside(mid) })
      }
    }
    const firstIn = parts.findIndex((p) => p.in)
    if (firstIn < 0) continue
    // Start on an inside part that follows an outside one (or the first, if the loop never leaves the circle).
    let k0 = firstIn
    for (let k = 0; k < parts.length; k++) {
      const prev = parts[(k + parts.length - 1) % parts.length]
      if (parts[k].in && !prev.in) {
        k0 = k
        break
      }
    }
    const ordered = [...parts.slice(k0), ...parts.slice(0, k0)]
    const s = start(ordered[0].piece)
    const cmds: string[] = [`M${f(s[0])} ${f(s[1])}`]
    let exit: Pt | undefined
    for (const part of ordered) {
      if (part.in) {
        if (exit) {
          // Back inside: close the gap along the circle, the short way round.
          const e = start(part.piece)
          const a1 = Math.atan2(exit[1] - c.cy, exit[0] - c.cx)
          const a2 = Math.atan2(e[1] - c.cy, e[0] - c.cx)
          let delta = a2 - a1
          while (delta > Math.PI) delta -= 2 * Math.PI
          while (delta < -Math.PI) delta += 2 * Math.PI
          cmds.push(
            `A${f(c.r)} ${f(c.r)} 0 0 ${delta > 0 ? 1 : 0} ${f(e[0])} ${f(e[1])}`,
          )
          exit = undefined
        }
        if (part.piece.kind === 'L')
          cmds.push(`L${f(part.piece.p[1][0])} ${f(part.piece.p[1][1])}`)
        else {
          const [, p1, p2, p3] = part.piece.p
          cmds.push(
            `C${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])} ${f(p3[0])} ${f(p3[1])}`,
          )
        }
      } else if (!exit) exit = start(part.piece)
    }
    if (exit) {
      // The loop ends outside: the final gap closes back to where we began.
      const a1 = Math.atan2(exit[1] - c.cy, exit[0] - c.cx)
      const a2 = Math.atan2(s[1] - c.cy, s[0] - c.cx)
      let delta = a2 - a1
      while (delta > Math.PI) delta -= 2 * Math.PI
      while (delta < -Math.PI) delta += 2 * Math.PI
      cmds.push(
        `A${f(c.r)} ${f(c.r)} 0 0 ${delta > 0 ? 1 : 0} ${f(s[0])} ${f(s[1])}`,
      )
    }
    cmds.push('Z')
    out.push(cmds.join(''))
    void end
  }
  return out.join('')
}
