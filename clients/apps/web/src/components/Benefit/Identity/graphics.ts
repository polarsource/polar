import {
  clamp01,
  easeInOutCubic as ease,
  type GraphicRenderer,
} from './BenefitGraphic'

const TAU = Math.PI * 2

interface Segment {
  path: Path2D
  len: number
}

/**
 * Strokes a sequence of segments as if they were one continuous line,
 * revealing the first `drawn` units of cumulative length.
 */
const strokeSequence = (
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  drawn: number,
) => {
  let consumed = 0
  for (const segment of segments) {
    const visible = clamp01((drawn - consumed) / segment.len) * segment.len
    if (visible > 0.5) {
      ctx.setLineDash([visible, segment.len + 1])
      ctx.lineDashOffset = 0
      ctx.stroke(segment.path)
    }
    consumed += segment.len
  }
  ctx.setLineDash([])
}

// Custom — a ring of radial ticks with a comet highlight orbiting them,
// echoing the type's loader icon.
export const customGraphic: GraphicRenderer = (ctx, size, elapsed, colors) => {
  const cx = size / 2
  const cy = size / 2
  const inner = size * 0.2
  const outer = size * 0.34
  const ticks = 8
  const head = (elapsed / 3.5) * TAU

  for (let i = 0; i < ticks; i++) {
    const angle = (i / ticks) * TAU - Math.PI / 2
    const x0 = cx + Math.cos(angle) * inner
    const y0 = cy + Math.sin(angle) * inner
    const x1 = cx + Math.cos(angle) * outer
    const y1 = cy + Math.sin(angle) * outer

    ctx.strokeStyle = colors.dim
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()

    const phase = (((head - angle) % TAU) + TAU) % TAU
    const alpha = Math.pow(1 - phase / TAU, 3)
    if (alpha > 0.02) {
      ctx.globalAlpha = alpha
      ctx.strokeStyle = colors.stroke
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}

// Downloadables — an arrow drawing itself downward into a tray,
// then draining out, in the landing page's fill/drain idiom.
export const downloadablesGraphic: GraphicRenderer = (
  ctx,
  size,
  elapsed,
  colors,
) => {
  const cx = size / 2
  const shaftTop = size * 0.24
  const shaftBottom = size * 0.55
  const headLen = size * 0.11
  const headAngle = Math.PI / 4

  const shaft = new Path2D()
  shaft.moveTo(cx, shaftTop)
  shaft.lineTo(cx, shaftBottom)

  const flank = (dir: number) => {
    const p = new Path2D()
    p.moveTo(cx, shaftBottom)
    p.lineTo(
      cx + dir * Math.sin(headAngle) * headLen,
      shaftBottom - Math.cos(headAngle) * headLen,
    )
    return p
  }
  const leftFlank = flank(-1)
  const rightFlank = flank(1)

  const tray = new Path2D()
  tray.moveTo(size * 0.3, size * 0.6)
  tray.lineTo(size * 0.3, size * 0.72)
  tray.lineTo(size * 0.7, size * 0.72)
  tray.lineTo(size * 0.7, size * 0.6)

  const shaftLen = shaftBottom - shaftTop
  const totalLen = shaftLen + headLen
  const t = (elapsed % 6) / 6

  let dashStart: number
  let dashEnd: number
  if (t < 0.5) {
    dashStart = 0
    dashEnd = ease(t / 0.5) * totalLen
  } else {
    dashStart = ease((t - 0.5) / 0.5) * totalLen
    dashEnd = totalLen
  }

  ctx.strokeStyle = colors.dim
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.stroke(shaft)
  ctx.stroke(leftFlank)
  ctx.stroke(rightFlank)
  ctx.stroke(tray)

  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = 2.5

  const shaftVisibleStart = Math.min(dashStart, shaftLen)
  const shaftVisible = Math.min(dashEnd, shaftLen) - shaftVisibleStart
  if (shaftVisible > 0.5) {
    ctx.setLineDash([shaftVisible, shaftLen + 1])
    ctx.lineDashOffset = -shaftVisibleStart
    ctx.stroke(shaft)
  }

  const flankStart = Math.max(0, dashStart - shaftLen)
  const flankVisible = Math.max(0, dashEnd - shaftLen) - flankStart
  if (flankVisible > 0.5) {
    ctx.setLineDash([flankVisible, headLen + 1])
    ctx.lineDashOffset = -flankStart
    ctx.stroke(leftFlank)
    ctx.stroke(rightFlank)
  }

  ctx.setLineDash([])
  ctx.globalCompositeOperation = 'source-over'
}

// License keys — a key outline drawing itself in (head, shaft, teeth),
// holding, then fading out.
export const licenseKeysGraphic: GraphicRenderer = (
  ctx,
  size,
  elapsed,
  colors,
) => {
  const cy = size * 0.5
  const headCx = size * 0.34
  const headR = size * 0.115

  const head = new Path2D()
  head.arc(headCx, cy, headR, -Math.PI / 2, Math.PI * 1.5)

  const shaft = new Path2D()
  shaft.moveTo(headCx + headR, cy)
  shaft.lineTo(size * 0.74, cy)
  shaft.lineTo(size * 0.74, size * 0.6)

  const tooth = new Path2D()
  tooth.moveTo(size * 0.63, cy)
  tooth.lineTo(size * 0.63, size * 0.58)

  const segments: Segment[] = [
    { path: head, len: TAU * headR },
    { path: shaft, len: size * (0.74 - 0.34) - headR + size * 0.1 },
    { path: tooth, len: size * 0.08 },
  ]
  const totalLen = segments.reduce((acc, s) => acc + s.len, 0)

  ctx.strokeStyle = colors.dim
  ctx.lineWidth = 2
  ctx.setLineDash([])
  segments.forEach((s) => ctx.stroke(s.path))

  const t = (elapsed % 6) / 6
  let drawn = 0
  let alpha = 1
  if (t < 0.4) {
    drawn = ease(t / 0.4) * totalLen
  } else if (t < 0.75) {
    drawn = totalLen
  } else if (t < 0.95) {
    drawn = totalLen
    alpha = 1 - ease((t - 0.75) / 0.2)
  }

  if (drawn > 0.5 && alpha > 0.02) {
    ctx.globalAlpha = alpha
    ctx.strokeStyle = colors.stroke
    ctx.lineWidth = 2.5
    strokeSequence(ctx, segments, drawn)
    ctx.globalAlpha = 1
  }
}

// Meter credits — a gauge whose needle sweeps up and settles back,
// the arc filling behind it.
export const meterCreditGraphic: GraphicRenderer = (
  ctx,
  size,
  elapsed,
  colors,
) => {
  const cx = size * 0.5
  const cy = size * 0.55
  const r = size * 0.3
  const startAngle = Math.PI * 0.75
  const sweep = Math.PI * 1.5

  const t = (elapsed % 7) / 7
  let p: number
  if (t < 0.4) {
    p = ease(t / 0.4)
  } else if (t < 0.52) {
    p = 1
  } else if (t < 0.92) {
    p = 1 - ease((t - 0.52) / 0.4)
  } else {
    p = 0
  }
  const value = 0.08 + p * 0.78
  const needleAngle = startAngle + value * sweep

  ctx.strokeStyle = colors.dim
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAngle, startAngle + sweep)
  ctx.stroke()

  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAngle, needleAngle)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'

  const tickCount = 7
  for (let i = 0; i < tickCount; i++) {
    const angle = startAngle + (i / (tickCount - 1)) * sweep
    ctx.strokeStyle = colors.dim
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * r * 0.86, cy + Math.sin(angle) * r * 0.86)
    ctx.lineTo(cx + Math.cos(angle) * r * 0.94, cy + Math.sin(angle) * r * 0.94)
    ctx.stroke()
  }

  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(
    cx + Math.cos(needleAngle) * r * 0.25,
    cy + Math.sin(needleAngle) * r * 0.25,
  )
  ctx.lineTo(
    cx + Math.cos(needleAngle) * r * 0.72,
    cy + Math.sin(needleAngle) * r * 0.72,
  )
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.02, 0, TAU)
  ctx.stroke()
}

// Feature flag — a toggle whose knob slides on and off, the pill
// outline brightening while enabled.
export const featureFlagGraphic: GraphicRenderer = (
  ctx,
  size,
  elapsed,
  colors,
) => {
  const pillW = size * 0.46
  const pillH = size * 0.24
  const pillX = (size - pillW) / 2
  const pillY = (size - pillH) / 2

  const pill = new Path2D()
  pill.roundRect(pillX, pillY, pillW, pillH, pillH / 2)

  const t = (elapsed % 6) / 6
  let onProgress: number
  if (t < 0.3) {
    onProgress = ease(t / 0.3)
  } else if (t < 0.5) {
    onProgress = 1
  } else if (t < 0.8) {
    onProgress = 1 - ease((t - 0.5) / 0.3)
  } else {
    onProgress = 0
  }

  ctx.strokeStyle = colors.dim
  ctx.lineWidth = 2
  ctx.stroke(pill)

  if (onProgress > 0.02) {
    ctx.globalAlpha = onProgress
    ctx.strokeStyle = colors.stroke
    ctx.lineWidth = 2
    ctx.stroke(pill)
    ctx.globalAlpha = 1
  }

  const knobTravel = pillW - pillH
  const knobX = pillX + pillH / 2 + onProgress * knobTravel
  const knobCy = size / 2

  ctx.strokeStyle = colors.stroke
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(knobX, knobCy, size * 0.075, 0, TAU)
  ctx.stroke()

  if (onProgress > 0.02) {
    ctx.globalAlpha = onProgress
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(knobX, knobCy, size * 0.028, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
