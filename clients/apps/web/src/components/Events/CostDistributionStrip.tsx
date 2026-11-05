import { formatCostAmount } from '@/utils/formatters'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { MouseEvent, useRef, useState } from 'react'

export const percentile = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]

// Costs span orders of magnitude, so place them on a log scale.
const logScale = (values: number[]) => {
  const positive = values.filter((value) => value > 0)
  if (positive.length === 0) return () => 50
  const low = Math.log10(Math.min(...positive))
  const high = Math.log10(Math.max(...positive))
  return (value: number) => {
    if (value <= 0) return 0
    if (high === low) return 50
    return ((Math.log10(value) - low) / (high - low)) * 100
  }
}

const Marker = ({ position, label }: { position: number; label: string }) => (
  <div
    className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
    style={{ left: `${position}%` }}
  >
    <div className="dark:bg-polar-500 h-3 w-px bg-gray-400" />
    <span className="dark:text-polar-500 mt-1 text-xs leading-none text-gray-400">
      {label}
    </span>
  </div>
)

// Share of samples at or below `value`, as a percentile label.
const rankOf = (sorted: number[], value: number) => {
  const below = sorted.filter((sample) => sample <= value).length
  return `p${Math.max(1, Math.round((below / sorted.length) * 100))}`
}

// Every sample as a tick on a log scale, with the average and p99 marked.
// Hovering shows the nearest sample's cost and where it ranks.
export const CostDistributionStrip = ({
  costs,
  highlight,
}: {
  costs: number[]
  highlight?: number
}) => {
  const sorted = costs.toSorted((a, b) => a - b)
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  const p99 = percentile(sorted, 0.99)
  const position = logScale(
    highlight !== undefined ? [...sorted, highlight] : sorted,
  )
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const x = ((event.clientX - rect.left) / rect.width) * 100
    let nearest = sorted[0]
    for (const value of sorted) {
      if (Math.abs(position(value) - x) < Math.abs(position(nearest) - x)) {
        nearest = value
      }
    }
    setHovered(nearest)
  }

  return (
    <div
      ref={ref}
      className="relative h-7 cursor-crosshair"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHovered(null)}
    >
      <div className="dark:bg-polar-700 absolute inset-x-0 top-1.5 h-px bg-gray-200" />
      {sorted.map((value, index) => (
        <div
          key={index}
          className={
            value === hovered
              ? 'absolute top-0 h-3 w-px bg-gray-900 dark:bg-white'
              : 'dark:bg-polar-600 absolute top-0.5 h-2 w-px bg-gray-300'
          }
          style={{ left: `${position(value)}%` }}
        />
      ))}
      <Marker position={position(average)} label="avg" />
      <Marker position={position(p99)} label="p99" />
      {highlight !== undefined && (
        <div
          className="absolute -top-0.5 h-4 w-px -translate-x-1/2 bg-gray-900 dark:bg-white"
          style={{ left: `${position(highlight)}%` }}
        />
      )}
      {hovered !== null && (
        <Tooltip open delayDuration={0}>
          <TooltipTrigger asChild>
            <span
              className="pointer-events-none absolute top-0 h-3 w-0"
              style={{ left: `${position(hovered)}%` }}
            />
          </TooltipTrigger>
          <TooltipContent side="top">
            <Text variant="caption" tabularNums>
              {formatCostAmount(hovered)} · {rankOf(sorted, hovered)}
            </Text>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
