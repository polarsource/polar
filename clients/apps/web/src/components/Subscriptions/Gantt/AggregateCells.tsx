import { type AggregateRow } from '@/utils/subscriptionAggregate'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type GanttScale } from './scale'
import { TONE_OPACITY } from './tone'

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
        const left = scale.toX(bucket.start)
        const width = scale.toX(bucket.end) - left
        const amount = bucket.renewingAmount + bucket.atRiskAmount
        return (
          <div
            key={bucket.start}
            className={
              bucket.start === hoveredStart
                ? 'dark:bg-polar-800/50 absolute inset-y-0 cursor-pointer bg-gray-50'
                : 'absolute inset-y-0 cursor-pointer'
            }
            style={{ left, width }}
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
                <Box
                  flexGrow={bucket.atRiskAmount}
                  backgroundColor="background-warning"
                />
                <Box
                  flexGrow={bucket.renewingAmount}
                  backgroundColor="background-inverse"
                  opacity={TONE_OPACITY['background-inverse']}
                />
              </div>
            </Box>
          </div>
        )
      })}
    </Box>
  )
}
