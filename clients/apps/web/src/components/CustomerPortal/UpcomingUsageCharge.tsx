import { useCustomerSubscriptionMeterChargePreview } from '@/hooks/queries/customerPortal'
import { billsUsageOnMeterCycle } from '@/utils/subscription'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Box } from '@polar-sh/orbit/Box'
import {
  PortalDivider,
  PortalRow,
  PortalRows,
  PortalText,
} from './PortalPrimitives'

interface UpcomingUsageChargeProps {
  subscription: schemas['CustomerSubscription']
  api: Client
}

export const UpcomingUsageCharge = ({
  subscription,
  api,
}: UpcomingUsageChargeProps) => {
  const meters = subscription.meters.filter((meter) => meter.amount > 0)
  const showsCharge = billsUsageOnMeterCycle(subscription) && meters.length > 0

  const { data: preview } = useCustomerSubscriptionMeterChargePreview(
    api,
    subscription.id,
    showsCharge,
  )

  if (!showsCharge) {
    return null
  }

  const hasTaxes = preview && preview.tax_amount > 0
  const hasDiscount = preview && preview.discount_amount > 0

  const format = (amount: number) =>
    formatCurrency('compact')(amount, subscription.currency)

  const chargeDateLabel = `Due ${
    subscription.current_meter_period_end
      ? new Date(subscription.current_meter_period_end).toLocaleDateString(
          'en-US',
          { dateStyle: 'medium' },
        )
      : 'N/A'
  }`

  return (
    <Box
      flexDirection="column"
      rowGap="m"
      paddingTop="l"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Box as="span" color="text-primary">
          Upcoming usage charge
        </Box>
        <PortalText tone="secondary" className="text-sm">
          {chargeDateLabel}
        </PortalText>
      </Box>

      <PortalRows>
        {meters.map((meter) => (
          <PortalRow
            key={meter.id}
            label={meter.meter.name}
            value={format(meter.amount)}
          />
        ))}
      </PortalRows>

      <PortalDivider />

      <PortalRows>
        {(hasTaxes || hasDiscount) && (
          <PortalRow label="Subtotal" value={format(preview.subtotal_amount)} />
        )}
        {hasDiscount && (
          <PortalRow
            label="Discount"
            value={format(-1 * preview.discount_amount)}
          />
        )}
        {hasTaxes && (
          <PortalRow label="Taxes" value={format(preview.tax_amount)} />
        )}
        <PortalRow
          emphasis
          label="Estimated total"
          value={
            preview ? (
              format(preview.total_amount)
            ) : (
              <PortalText tone="tertiary" className="animate-pulse">
                Loading…
              </PortalText>
            )
          }
        />
      </PortalRows>

      <PortalText tone="tertiary" className="text-xs">
        {subscription.status === 'trialing'
          ? 'Final amount may vary based on usage during the trial period.'
          : 'Final amount may vary based on usage until the end of the usage period.'}
      </PortalText>
    </Box>
  )
}
