import { useMemo } from 'react'

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)

export interface Dot {
  x: number
  y: number
  r: number
}

export function generatePhyllotaxis(
  count: number,
  spread: number,
  centerX: number,
  centerY: number,
): Dot[] {
  const dots: Dot[] = []
  for (let i = 1; i <= count; i++) {
    const angle = i * GOLDEN_ANGLE
    const radius = spread * Math.sqrt(i)
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    dots.push({ x, y, r: 2 })
  }
  return dots
}

export function PhyllotaxisSunflower({
  size = 400,
  fill = 'black',
}: {
  size?: number
  fill?: string
}) {
  const center = size / 2
  const dots = useMemo(() => {
    const allDots = generatePhyllotaxis(300, size / 37.5, center, center)
    const maxRadius = size / 2 - 20
    return allDots.filter((dot) => {
      const dx = dot.x - center
      const dy = dot.y - center
      return Math.sqrt(dx * dx + dy * dy) <= maxRadius
    })
  }, [center, size])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="max-w-full"
    >
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={fill} />
      ))}
    </svg>
  )
}
