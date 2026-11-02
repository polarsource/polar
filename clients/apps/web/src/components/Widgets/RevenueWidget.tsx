import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDownRight, ArrowUpRight } from '@polar-sh/orbit/icons'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { useContext } from 'react'
import { SegmentedBars } from './SegmentedBars'
import { WidgetContainer } from './WidgetContainer'
import { WidgetLink } from './WidgetLink'
import { WidgetGuard } from './WidgetGuard'

interface RevenueWidgetProps {
  className?: string
}

const WIDGET_TITLE = 'Revenue'
const MONTHS = 6

const RevenueWidget = ({ className }: RevenueWidgetProps) => (
  <WidgetGuard
    permission="analytics:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <RevenueWidgetContent className={className} />
  </WidgetGuard>
)

const Change = ({
  current,
  previous,
}: {
  current: number
  previous: number
}) => {
  if (previous === 0) return null
  const change = ((current - previous) / Math.abs(previous)) * 100
  if (!Number.isFinite(change) || Math.round(change) === 0) return null
  const Arrow = change > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <Text>
      <Box
        as="span"
        display="inline-block"
        marginRight="xs"
        color={change > 0 ? 'text-success' : 'text-danger'}
      >
        <Arrow className="inline h-4 w-4 align-[-2px]" />
      </Box>
      {Math.abs(change).toFixed(0)}%
    </Text>
  )
}

const RevenueWidgetContent = ({ className }: RevenueWidgetProps) => {
  const { organization } = useContext(OrganizationContext)

  const { data, isLoading } = useMetrics({
    startDate: startOfMonth(subMonths(new Date(), MONTHS - 1)),
    endDate: endOfMonth(new Date()),
    organization_id: organization.id,
    interval: 'month',
    metrics: ['revenue'],
  })

  const today = new Date()
  const { data: previousToDate } = useMetrics({
    startDate: startOfMonth(subMonths(today, 1)),
    endDate: subMonths(today, 1),
    organization_id: organization.id,
    interval: 'month',
    metrics: ['revenue'],
  })

  const periods = data?.periods ?? []
  const currentMonth = periods.at(-1)
  const current = currentMonth?.revenue ?? 0
  const previous = previousToDate?.totals.revenue ?? 0

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {formatCurrency('statistics')(current, 'usd')}
          </Text>
          {data && previousToDate && (
            <Change current={current} previous={previous} />
          )}
          {currentMonth && (
            <Text color="muted">{format(currentMonth.timestamp, 'MMMM')}</Text>
          )}
        </Box>
      }
      action={
        <WidgetLink
          href={`/dashboard/${organization.slug}/analytics/metrics`}
        />
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
          bars={periods.map((period, index) => ({
            key: period.timestamp,
            label: format(period.timestamp, 'MMM'),
            value: period.revenue ?? 0,
            tooltip: `${formatCurrency('compact')(period.revenue ?? 0, 'usd')} in ${format(period.timestamp, 'MMMM')}`,
            highlighted: index === periods.length - 1,
          }))}
        />
      </Box>
    </WidgetContainer>
  )
}

export default RevenueWidget
