import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const BAR_STAGGER_MS = 250

const OPACITY = { active: 0.8, idle: 0.35, dimmed: 0.15 } as const

export type HistogramBarState = keyof typeof OPACITY

export const HistogramBar = ({
  count,
  max,
  index,
  total,
  state,
  highlighted,
  width,
}: {
  count: number
  max: number
  index: number
  total: number
  state: HistogramBarState
  highlighted: boolean
  width?: number
}) => (
  <Box
    width={width}
    flexShrink={0}
    flexGrow={width === undefined ? 1 : 0}
    flexBasis={width === undefined ? 0 : undefined}
    height="100%"
    alignItems="end"
    backgroundColor={highlighted ? 'background-card' : undefined}
  >
    {count > 0 && (
      <div
        className="motion-safe:animate-bar-grow w-full origin-bottom"
        style={{
          height: `${(count / max) * 100}%`,
          minHeight: 2,
          animationDelay: `${(index / total) * BAR_STAGGER_MS}ms`,
          transition: 'height 200ms cubic-bezier(0, 0, 0, 1)',
        }}
      >
        <Box
          width="100%"
          height="100%"
          backgroundColor="background-inverse"
          opacity={OPACITY[state]}
          transitionProperty="opacity"
          transitionDuration="fast"
        />
      </div>
    )}
  </Box>
)

// One tooltip for the whole chart, anchored to the hovered bar, instead of a
// Radix tooltip per bar.
export const HistogramTooltip = ({
  index,
  total,
  label,
}: {
  index: number
  total: number
  label: string
}) => (
  <Tooltip key={index} open delayDuration={0}>
    <TooltipTrigger asChild>
      <span
        className="pointer-events-none absolute top-0 h-full w-0"
        style={{ left: `${((index + 0.5) / total) * 100}%` }}
      />
    </TooltipTrigger>
    <TooltipContent side="top">
      <Text variant="caption" tabularNums>
        {label}
      </Text>
    </TooltipContent>
  </Tooltip>
)
