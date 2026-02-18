import { SectionLayout } from './SectionLayout'

function isLight(hex: string): boolean {
  const v = parseInt(hex.replace('#', ''), 16)
  const r = (v >> 16) & 255
  const g = (v >> 8) & 255
  const b = v & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}

interface ColorEntry {
  name: string
  hex: string
  // hsl source kept for reference, not displayed
  oklch: [number, number, number] // L%  C  H
  flex: number
  note?: string
}

// Monochromatic scale — all at hsl(233, 5%, L%), i.e. oklch hue ≈ 270°
// One accent: same hue, saturation lifted to distinguish it as the brand accent.
const COLORS: ColorEntry[] = [
  {
    name: 'Night',
    hex: '#070708',
    oklch: [0.1291, 0.0026, 286.03],
    flex: 3,
  },
  {
    name: 'Snow',
    hex: '#F5F6FA',
    oklch: [0.9735, 0.0054, 274.97],
    flex: 3,
  },
  {
    name: 'Ash',
    hex: '#1D1E22',
    oklch: [0.2357, 0.0078, 274.61],
    flex: 1,
  },
  {
    name: 'Stone',
    hex: '#7E8090',
    oklch: [0.6036, 0.0243, 279.99],
    flex: 1,
  },
  {
    name: 'Mist',
    hex: '#C7C8CE',
    oklch: [0.8338, 0.0084, 278.61],
    flex: 1,
  },
  {
    // Same hue (270°), chroma lifted to ~0.09 — the faint
    // luminescence of aurora light on the polar horizon.
    name: 'Ether',
    hex: '#7B8FD4',
    oklch: [62, 0.09, 270],
    flex: 1,
    note: 'accent',
  },
]

function ColorColumn({ color }: { color: ColorEntry }) {
  const light = isLight(color.hex)
  const fg = light ? '#000000' : '#ffffff'
  const fgMuted = light ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)'
  const [l, c, h] = color.oklch

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ flex: color.flex, backgroundColor: color.hex, color: fg }}
    >
      {/* Name — vertically centred */}
      <div className="flex flex-1 items-center p-8 md:p-10">
        <span className="text-sm font-medium tracking-tight md:text-base">
          {color.name}
        </span>
      </div>

      {/* Values — bottom */}
      <div className="flex flex-col gap-3 p-8 font-mono text-xs leading-snug md:p-10">
        <div>
          <div style={{ color: fgMuted }}>HEX</div>
          <div>{color.hex}</div>
        </div>
        <div>
          <div style={{ color: fgMuted }}>OKLCH</div>
          <div className="whitespace-nowrap">
            {l}% {c} {h}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ColorsSection() {
  return (
    <SectionLayout label="Color Palette">
      <div className="dark:border-polar-700 flex w-full flex-col overflow-hidden rounded-sm border border-neutral-200 md:flex-row">
        {COLORS.map((color) => (
          <ColorColumn key={color.name} color={color} />
        ))}
      </div>
    </SectionLayout>
  )
}
