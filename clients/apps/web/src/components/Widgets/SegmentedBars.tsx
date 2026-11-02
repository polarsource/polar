import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const SEGMENTS = 18

export interface SegmentedBar {
  key: string
  label: string
  value: number
  tooltip: string
  highlighted?: boolean
}

const filledSegments = (value: number, max: number) =>
  value > 0
    ? Math.min(SEGMENTS, Math.max(1, Math.round((value / max) * SEGMENTS)))
    : 0

const Segment = ({
  color,
}: {
  color: 'text-primary' | 'text-accent' | 'text-disabled'
}) => (
  <Box color={color}>
    <div className="h-px w-full bg-current" />
  </Box>
)

export const SegmentedBars = ({
  bars,
  loading,
  max: fixedMax,
}: {
  bars: SegmentedBar[]
  loading?: boolean
  max?: number
}) => {
  const max = fixedMax ?? Math.max(1, ...bars.map((bar) => bar.value))

  return (
    <Box flex={1} minHeight={160} columnGap="m" alignItems="stretch">
      {bars.map((bar) => {
        const filled = loading ? 0 : filledSegments(bar.value, max)
        const litColor = bar.highlighted ? 'text-accent' : 'text-primary'

        return (
          <Box key={bar.key} flex={1} flexDirection="column" rowGap="s">
            <Tooltip>
              <TooltipTrigger className="flex w-full flex-1 cursor-default flex-col">
                <Box flex={1} flexDirection="column" justifyContent="between">
                  {Array.from({ length: SEGMENTS }, (_, index) => (
                    <Segment
                      key={index}
                      color={
                        index >= SEGMENTS - filled ? litColor : 'text-disabled'
                      }
                    />
                  ))}
                </Box>
              </TooltipTrigger>
              <TooltipContent>{bar.tooltip}</TooltipContent>
            </Tooltip>
            <Box justifyContent="center">
              <Text color={bar.highlighted ? 'default' : 'muted'}>
                {bar.label}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
