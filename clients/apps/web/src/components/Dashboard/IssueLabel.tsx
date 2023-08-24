import { useTheme } from 'next-themes'
import { Label } from 'polarkit/api/client'

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

const IssueLabel = (props: { label: Label }) => {
  const { name, color } = props.label

  const { resolvedTheme } = useTheme()

  const rgb = hexToRgb(color)
  const hsv = rgb ? RGBtoHSV(rgb.r, rgb.g, rgb.b) : null
  const bgColor = HSVtoRGB(
    hsv ? hsv.h : 0,
    resolvedTheme === 'dark' ? 0.3 : 0.17,
    resolvedTheme === 'dark' ? 0.35 : 0.94,
  )
  const textColor = HSVtoRGB(
    hsv ? hsv.h : 0,
    resolvedTheme === 'dark' ? 0.2 : 0.25,
    resolvedTheme === 'dark' ? 0.8 : 0.35,
  )

  const style = {
    backgroundColor: bgColor
      ? `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`
      : `rgb(200, 200, 200)`,
    color: textColor
      ? `rgb(${textColor.r}, ${textColor.g}, ${textColor.b})`
      : `rgb(50, 50, 50)`,
  }

  return (
    <>
      <div
        className="whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-medium"
        style={style}
      >
        {name}
      </div>
    </>
  )
}

export default IssueLabel
