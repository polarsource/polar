import { components } from '@polar-sh/client'

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function HSVtoRGB(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } | null {
  var r, g, b, i, f, p, q, t
  i = Math.floor(h * 6)
  f = h * 6 - i
  p = v * (1 - s)
  q = v * (1 - f * s)
  t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0:
      ;(r = v), (g = t), (b = p)
      break
    case 1:
      ;(r = q), (g = v), (b = p)
      break
    case 2:
      ;(r = p), (g = v), (b = t)
      break
    case 3:
      ;(r = p), (g = q), (b = v)
      break
    case 4:
      ;(r = t), (g = p), (b = v)
      break
    case 5:
      ;(r = v), (g = p), (b = q)
      break
  }

  return r && g && b
    ? { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
    : null
}

function RGBtoHSV(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; v: number } | null {
  var max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    h,
    s = max === 0 ? 0 : d / max,
    v = max / 255

  switch (max) {
    case min:
      h = 0
      break
    case r:
      h = g - b + d * (g < b ? 6 : 0)
      h /= 6 * d
      break
    case g:
      h = b - r + d * 2
      h /= 6 * d
      break
    case b:
      h = r - g + d * 4
      h /= 6 * d
      break
  }

  return h && s && v ? { h: h, s: s, v: v } : null
}

const BG_SATURATION_LIGHT = 0.17
const BG_SATURATION_DARK = 0.3
const BG_VALUE_LIGHT = 0.94
const BG_VALUE_DARK = 0.35

const TEXT_SATURATION_LIGHT = 0.25
const TEXT_SATURATION_DARK = 0.2
const TEXT_VALUE_LIGHT = 0.35
const TEXT_VALUE_DARK = 0.8

const IssueLabel = (props: { label: components['schemas']['Label'] }) => {
  const { name, color } = props.label

  const rgb = hexToRgb(color)
  const hsv = rgb ? RGBtoHSV(rgb.r, rgb.g, rgb.b) : null

  const bgColorLight = HSVtoRGB(
    hsv ? hsv.h : 0,
    BG_SATURATION_LIGHT,
    BG_VALUE_LIGHT,
  )
  const bgColorDark = HSVtoRGB(
    hsv ? hsv.h : 0,
    BG_SATURATION_DARK,
    BG_VALUE_DARK,
  )

  const textColorLight = HSVtoRGB(
    hsv ? hsv.h : 0,
    TEXT_SATURATION_LIGHT,
    TEXT_VALUE_LIGHT,
  )
  const textColorDark = HSVtoRGB(
    hsv ? hsv.h : 0,
    TEXT_SATURATION_DARK,
    TEXT_VALUE_DARK,
  )

  const style = {
    '--bg-light-r': bgColorLight?.r,
    '--bg-light-g': bgColorLight?.g,
    '--bg-light-b': bgColorLight?.b,
    '--bg-dark-r': bgColorDark?.r,
    '--bg-dark-g': bgColorDark?.g,
    '--bg-dark-b': bgColorDark?.b,
    '--text-light-r': textColorLight?.r,
    '--text-light-g': textColorLight?.g,
    '--text-light-b': textColorLight?.b,
    '--text-dark-r': textColorDark?.r,
    '--text-dark-g': textColorDark?.g,
    '--text-dark-b': textColorDark?.b,
  } as React.CSSProperties

  return (
    <>
      <div
        className="text whitespace-nowrap rounded-xl bg-[rgb(var(--bg-light-r),var(--bg-light-g),var(--bg-light-b))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--text-light-r),var(--text-light-g),var(--text-light-b))] dark:bg-[rgb(var(--bg-dark-r),var(--bg-dark-g),var(--bg-dark-b))] dark:text-[rgb(var(--text-dark-r),var(--text-dark-g),var(--text-dark-b))]"
        style={style}
      >
        {name}
      </div>
    </>
  )
}

export default IssueLabel
