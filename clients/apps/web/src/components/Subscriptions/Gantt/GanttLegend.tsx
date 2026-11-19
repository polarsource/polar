import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { GanttFill } from './GanttFill'
import { BAR_RADIUS } from './scale'
import { type GanttPattern, type GanttTone } from './tone'

interface LegendItem {
  label: string
  tone?: GanttTone
  pattern?: GanttPattern
  strength?: number
}

const AGGREGATE_ITEMS: LegendItem[] = [
  { label: 'Renewing', tone: 'success' },
  { label: 'Ending or past due', tone: 'warning' },
]

const CUSTOMER_ITEMS: LegendItem[] = [
  { label: 'Active', tone: 'success', strength: 0.5 },
  { label: 'Current period', tone: 'success' },
  { label: 'Ending', tone: 'warning' },
  { label: 'Past due', tone: 'danger' },
  { label: 'Trial', tone: 'success', pattern: 'trial' },
  { label: 'Paused', pattern: 'paused' },
  { label: 'Ended', strength: 0.5 },
]

export const GanttLegend = ({ aggregate }: { aggregate: boolean }) => (
  <Box flexWrap="wrap" alignItems="center" columnGap="l" rowGap="s">
    {(aggregate ? AGGREGATE_ITEMS : CUSTOMER_ITEMS).map(
      ({ label, ...fill }) => (
        <Box key={label} alignItems="center" columnGap="s">
          <div
            className="flex h-2.5 w-5 overflow-hidden"
            style={{ borderRadius: BAR_RADIUS }}
          >
            <GanttFill {...fill} />
          </div>
          <Text variant="caption" color="muted" wrap="nowrap">
            {label}
          </Text>
        </Box>
      ),
    )}
  </Box>
)
