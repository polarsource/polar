import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns'
import { useContext, useState } from 'react'
import { SegmentedBars } from './SegmentedBars'
import { WidgetContainer } from './WidgetContainer'
import { WidgetGuard } from './WidgetGuard'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Gross margin'
const MONTHS = 6
const TRAILING_DAYS = 30

interface GrossMarginWidgetProps {
  className?: string
}

export const GrossMarginWidget = ({ className }: GrossMarginWidgetProps) => (
  <WidgetGuard
    permission="analytics:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <GrossMarginWidgetContent className={className} />
  </WidgetGuard>
)

const marginPercentage = (revenue: number, costs: number) =>
  revenue > 0 ? Math.round(((revenue - costs) / revenue) * 100) : null

const GrossMarginWidgetContent = ({ className }: GrossMarginWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const [today] = useState(() => new Date())

  // Revenue is billed on each customer's anniversary while costs accrue daily,
  // so partial months swing wildly. Use a trailing window and complete months.
  const { data: trailing } = useMetrics({
    startDate: subDays(today, TRAILING_DAYS - 1),
    endDate: today,
    organization_id: organization.id,
    interval: 'day',
    metrics: ['revenue', 'costs'],
  })
  const { data: monthly, isLoading } = useMetrics({
    startDate: startOfMonth(subMonths(today, MONTHS)),
    endDate: endOfMonth(subMonths(today, 1)),
    organization_id: organization.id,
    interval: 'month',
    metrics: ['revenue', 'costs'],
  })

  const trailingMargin = trailing
    ? marginPercentage(trailing.totals.revenue ?? 0, trailing.totals.costs ?? 0)
    : null
  const periods = (monthly?.periods ?? []).map((period) => ({
    timestamp: period.timestamp,
    percentage: marginPercentage(period.revenue ?? 0, period.costs ?? 0),
  }))

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {trailingMargin != null ? `${trailingMargin}%` : '–'}
          </Text>
          <Text color="muted">Last {TRAILING_DAYS} days</Text>
        </Box>
      }
      action={
        <WidgetLink href={`/dashboard/${organization.slug}/analytics/costs`} />
      }
      className={className}
    >
      <Box
        flexDirection="column"
        flex={1}
        justifyContent="end"
        paddingBottom="xl"
      >
        <SegmentedBars
          loading={isLoading}
          max={100}
          bars={periods.map((period, index) => ({
            key: period.timestamp,
            label: format(period.timestamp, 'MMM'),
            value: Math.max(0, period.percentage ?? 0),
            negative: period.percentage != null && period.percentage < 0,
            tooltip:
              period.percentage != null
                ? `${period.percentage}% in ${format(period.timestamp, 'MMMM')}`
                : `No revenue in ${format(period.timestamp, 'MMMM')}`,
            highlighted: index === periods.length - 1,
          }))}
        />
      </Box>
    </WidgetContainer>
  )
}
