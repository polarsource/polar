import { useMetrics } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { useContext } from 'react'
import { MonthlyBars } from './MonthlyBars'
import { WidgetContainer } from './WidgetContainer'
import { WidgetLink } from './WidgetLink'
import { WidgetGuard } from './WidgetGuard'

interface RevenueWidgetProps {
  className?: string
}

const WIDGET_TITLE = 'Revenue'
const MONTHS = 5

// Whole dollars, then compact from $10K so six months of labels stay narrow.
const formatBarValue = (cents: number) =>
  Math.abs(cents) >= 1_000_000
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'usd',
        currencyDisplay: 'narrowSymbol',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(cents / 100)
    : formatCurrency('statistics')(Math.round(cents / 100) * 100, 'usd')

const RevenueWidget = ({ className }: RevenueWidgetProps) => (
  <WidgetGuard
    permission="analytics:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <RevenueWidgetContent className={className} />
  </WidgetGuard>
)

const RevenueWidgetContent = ({ className }: RevenueWidgetProps) => {
  const { organization } = useContext(OrganizationContext)

  const { data, isLoading } = useMetrics({
    startDate: startOfMonth(subMonths(new Date(), MONTHS - 1)),
    endDate: endOfMonth(new Date()),
    organization_id: organization.id,
    interval: 'month',
    metrics: ['revenue'],
  })

  const periods = data?.periods ?? []
  const currentMonth = periods.at(-1)
  const current = currentMonth?.revenue ?? 0

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {formatCurrency('statistics')(current, 'usd')}
          </Text>
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
      <Box flexDirection="column" paddingBottom="m">
        <MonthlyBars
          loading={isLoading}
          bars={periods.map((period, index) => ({
            key: period.timestamp,
            label: format(period.timestamp, 'MMM'),
            value: period.revenue ?? 0,
            formatted: formatBarValue(period.revenue ?? 0),
            highlighted: index === periods.length - 1,
          }))}
        />
      </Box>
    </WidgetContainer>
  )
}

export default RevenueWidget
