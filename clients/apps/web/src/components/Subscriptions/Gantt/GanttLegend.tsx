import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { HATCH } from './GanttBar'
import { BAR_RADIUS } from './scale'
import { TONE_OPACITY, type GanttTone } from './tone'

interface LegendItem {
  label: string
  tone?: GanttTone
  opacity?: number
}

const AGGREGATE_ITEMS: LegendItem[] = [
  { label: 'Renewing', tone: 'background-inverse' },
  { label: 'Ending or past due', tone: 'background-warning' },
]

const CUSTOMER_ITEMS: LegendItem[] = [
  { label: 'Active', tone: 'background-inverse', opacity: 0.5 },
  { label: 'Current period', tone: 'background-inverse' },
  { label: 'Past due or ending', tone: 'background-warning' },
  { label: 'Trial', opacity: 0.7 },
  { label: 'Paused', opacity: 0.45 },
]

export const GanttLegend = ({ aggregate }: { aggregate: boolean }) => (
  <Box flexWrap="wrap" alignItems="center" columnGap="l" rowGap="s">
    {(aggregate ? AGGREGATE_ITEMS : CUSTOMER_ITEMS).map(
      ({ label, tone, opacity }) => (
        <Box key={label} alignItems="center" columnGap="s">
          <div className="overflow-hidden" style={{ borderRadius: BAR_RADIUS }}>
            <Box
              width={20}
              height={10}
              opacity={(opacity ?? 1) * (tone ? TONE_OPACITY[tone] : 1)}
              {...(tone
                ? { backgroundColor: tone }
                : { color: 'text-tertiary' as const })}
            >
              {!tone && (
                <div className="size-full" style={{ backgroundImage: HATCH }} />
              )}
            </Box>
          </div>
          <Text variant="caption" color="muted" wrap="nowrap">
            {label}
          </Text>
        </Box>
      ),
    )}
  </Box>
)
