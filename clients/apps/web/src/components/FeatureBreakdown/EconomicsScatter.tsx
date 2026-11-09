import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatAmount } from './featureEconomics'
import { PointTooltip } from './ScatterTooltip'

export interface ScatterPoint {
  key: string
  label: string
  cost: number
  revenue: number
}

const HEIGHT = 340

// Costs and revenue span orders of magnitude, so both axes share one log
// scale. Zero sits on the axis.
const logScale = (values: number[]) => {
  const positive = values.filter((value) => value > 0)
  if (positive.length === 0) return null
  const low = Math.log10(Math.min(...positive) / 2)
  const high = Math.log10(Math.max(...positive) * 2)
  const ticks: number[] = []
  for (let power = Math.floor(low); power <= Math.ceil(high); power++) {
    const steps = high - low < 2 ? [1, 2, 5] : [1]
    for (const step of steps) {
      const tick = step * 10 ** power
      if (Math.log10(tick) >= low && Math.log10(tick) <= high) ticks.push(tick)
    }
  }
  return {
    ticks,
    // Position from 0 to 100.
    at: (value: number) =>
      value <= 0 ? 0 : ((Math.log10(value) - low) / (high - low)) * 100,
  }
}

const Axis = ({ children }: { children: string }) => (
  <Text variant="caption" color="muted">
    {children}
  </Text>
)

// Cost to serve against revenue on one log scale. Above the dashed
// break-even line a point costs more than it brings in.
export const EconomicsScatter = ({
  points,
  currency,
  focus,
  hovered,
  onHover,
  onSelect,
}: {
  points: ScatterPoint[]
  currency: string
  focus: Set<string> | null
  hovered: string | null
  onHover: (key: string | null) => void
  onSelect: (key: string) => void
}) => {
  // One scale for both axes puts break-even, where cost equals revenue, on
  // the diagonal from the lower left corner to the upper right.
  const scale = logScale(points.flatMap((p) => [p.revenue, p.cost]))
  if (!scale) return null
  const x = scale
  const y = scale

  return (
    <Box flexDirection="column" gap="s">
      <Box gap="s">
        <Box
          position="relative"
          width={48}
          height={HEIGHT}
          flexShrink={0}
          justifyContent="end"
        >
          {y.ticks.map((tick) => (
            <div
              key={tick}
              className="absolute right-0 translate-y-1/2"
              style={{ bottom: `${y.at(tick)}%` }}
            >
              <Axis>{formatAmount(tick, currency)}</Axis>
            </div>
          ))}
        </Box>
        <Box
          position="relative"
          flexGrow={1}
          height={HEIGHT}
          borderLeftWidth={1}
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <svg
            className="dark:text-polar-600 absolute inset-0 h-full w-full overflow-hidden text-gray-300"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              x1={0}
              y1={100}
              x2={100}
              y2={0}
              stroke="currentColor"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {points.map(({ key, label, cost, revenue }) => {
            const highlighted = hovered === key
            const dimmed =
              (focus !== null && !focus.has(key)) ||
              (hovered !== null && !highlighted)
            const position = {
              left: `${x.at(revenue)}%`,
              bottom: `${y.at(cost)}%`,
            }
            return (
              <Tooltip
                key={key}
                delayDuration={0}
                open={highlighted}
                onOpenChange={(open) => onHover(open ? key : null)}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={label}
                    onClick={() => onSelect(key)}
                    className={`absolute flex size-4 -translate-x-1/2 translate-y-1/2 cursor-pointer items-center justify-center ${
                      highlighted ? 'z-10' : ''
                    }`}
                    style={position}
                  >
                    <span
                      className={`size-1.5 rounded-full transition ${
                        highlighted ? 'scale-[1.75]' : ''
                      } ${
                        cost > revenue
                          ? 'bg-red-500'
                          : 'bg-gray-900 dark:bg-white'
                      }`}
                      style={{
                        opacity: dimmed ? 0.15 : highlighted ? 1 : 0.9,
                      }}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  <PointTooltip
                    label={label}
                    cost={cost}
                    revenue={revenue}
                    currency={currency}
                  />
                </TooltipContent>
              </Tooltip>
            )
          })}
        </Box>
      </Box>
      <Box gap="s">
        <Box width={48} flexShrink={0} justifyContent="end">
          <Axis>Cost</Axis>
        </Box>
        <Box position="relative" flexGrow={1} height={16}>
          {x.ticks
            // Leave room for the axis label at the right end.
            .filter((tick) => x.at(tick) < 88)
            .map((tick) => (
              <div
                key={tick}
                className="absolute -translate-x-1/2"
                style={{ left: `${x.at(tick)}%` }}
              >
                <Axis>{formatAmount(tick, currency)}</Axis>
              </div>
            ))}
          <div className="absolute right-0">
            <Axis>Revenue</Axis>
          </div>
        </Box>
      </Box>
    </Box>
  )
}
