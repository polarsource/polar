/**
 * The on-curve points of a path, as a drawing program would show them: the film's construction scenes mark these
 * with small squares. Absolute and relative M L H V C S Q T A Z; `corners` keeps only the points where the
 * direction turns, so a dense trace reads as a few anchors.
 */
export interface Anchor {
  x: number
  y: number
  sub: number
  curve: boolean
}

export function parsePath(d: string): Anchor[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
  const out: Anchor[] = []
  let cmd = ''
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    sub = -1,
    i = 0
  const num = () => Number(tokens[i++])
  const push = (px: number, py: number, curve = false) =>
    out.push({ x: px, y: py, sub, curve })
  while (i < tokens.length) {
    const t = tokens[i]
    if (/[a-zA-Z]/.test(t)) {
      cmd = t
      i++
      if (cmd === 'Z' || cmd === 'z') {
        x = sx
        y = sy
        continue
      }
    }
    const rel = cmd === cmd.toLowerCase()
    const dx = rel ? x : 0,
      dy = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M':
        x = dx + num()
        y = dy + num()
        sx = x
        sy = y
        sub++
        push(x, y)
        cmd = rel ? 'l' : 'L'
        break
      case 'L':
        x = dx + num()
        y = dy + num()
        push(x, y)
        break
      case 'H':
        x = dx + num()
        push(x, y)
        break
      case 'V':
        y = dy + num()
        push(x, y)
        break
      case 'C':
        i += 4
        x = dx + num()
        y = dy + num()
        push(x, y, true)
        break
      case 'S':
        i += 2
        x = dx + num()
        y = dy + num()
        push(x, y, true)
        break
      case 'Q':
        i += 2
        x = dx + num()
        y = dy + num()
        push(x, y, true)
        break
      case 'T':
        x = dx + num()
        y = dy + num()
        push(x, y, true)
        break
      case 'A':
        i += 5
        x = dx + num()
        y = dy + num()
        push(x, y, true)
        break
      default:
        i++
    }
  }
  return out
}

/** Drops anchors on a straight run: keeps the ends of curves and the corners where the direction turns by more than `deg`. */
export function corners(anchors: Anchor[], deg = 12): Anchor[] {
  const out: Anchor[] = []
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i],
      prev = anchors[i - 1],
      next = anchors[i + 1]
    if (
      !prev ||
      !next ||
      prev.sub !== a.sub ||
      next.sub !== a.sub ||
      a.curve ||
      next.curve
    ) {
      out.push(a)
      continue
    }
    const a1 = Math.atan2(a.y - prev.y, a.x - prev.x)
    const a2 = Math.atan2(next.y - a.y, next.x - a.x)
    let turn = Math.abs(a2 - a1)
    if (turn > Math.PI) turn = 2 * Math.PI - turn
    if (turn > (deg * Math.PI) / 180) out.push(a)
  }
  // the same point twice (a closing move) counts once
  return out.filter(
    (a, i) =>
      !out.slice(0, i).some((b) => Math.hypot(a.x - b.x, a.y - b.y) < 0.5),
  )
}
