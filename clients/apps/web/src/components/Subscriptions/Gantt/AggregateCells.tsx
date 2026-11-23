import { type AggregateRow } from '@/utils/subscriptionAggregate'
import { DAY_MS } from '@/utils/subscriptionTimeline'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type GanttScale } from './scale'
import { GanttFill } from './GanttFill'

const MIN_LABEL_WIDTH = 52
const LABEL_HEIGHT = 20
const CELL_PADDING = 12
const CELL_GAP = 2
const BAR_GAP = 2

interface AggregateCellsProps {
  row: AggregateRow
  height: number
  scale: GanttScale
  hoveredStart: number | null
  onHover: (start: number) => void
  onSelect: (start: number) => void
}

export const AggregateCells = ({
  row,
  height,
  scale,
  hoveredStart,
  onHover,
  onSelect,
}: AggregateCellsProps) => {
  const max = Math.max(
    1,
    ...row.buckets.map(
      ({ renewingAmount, atRiskAmount }) => renewingAmount + atRiskAmount,
    ),
  )
  const barArea = height - CELL_PADDING * 2 - LABEL_HEIGHT

  return (
    <Box position="relative" height={height}>
      {row.buckets.map((bucket) => {
        const width =
          ((bucket.end - bucket.start) / DAY_MS) * scale.pixelsPerDay
        const amount = bucket.renewingAmount + bucket.atRiskAmount
        return (
          <div
            key={bucket.start}
            className={
              bucket.start === hoveredStart
                ? 'dark:bg-polar-800/50 absolute inset-y-0 cursor-pointer bg-gray-50'
                : 'absolute inset-y-0 cursor-pointer'
            }
            style={{
              left: scale.x(bucket.start),
              width: scale.span(bucket.start, bucket.end),
            }}
            onMouseEnter={() => onHover(bucket.start)}
            onClick={() => onSelect(bucket.start)}
          >
            <Box
              flexDirection="column"
              justifyContent="end"
              height="100%"
              py="m"
            >
              {amount > 0 && width >= MIN_LABEL_WIDTH && (
                <Box height={LABEL_HEIGHT} flexShrink={0} px="xs">
                  <Text
                    variant="caption"
                    color="muted"
                    wrap="nowrap"
                    tabularNums
                  >
                    {formatCurrency('compact')(amount, row.currency)}
                  </Text>
                </Box>
              )}
              <div
                className="flex flex-col overflow-hidden"
                style={{
                  height: Math.max(
                    amount > 0 ? 2 : 0,
                    (amount / max) * barArea,
                  ),
                  gap: bucket.atRiskAmount > 0 ? CELL_GAP : 0,
                  marginRight: BAR_GAP,
                }}
              >
                <Box flexGrow={bucket.atRiskAmount} flexBasis={0}>
                  <GanttFill tone="warning" />
                </Box>
                <Box flexGrow={bucket.renewingAmount} flexBasis={0}>
                  <GanttFill />
                </Box>
              </div>
            </Box>
          </div>
        )
      })}
    </Box>
  )
}
