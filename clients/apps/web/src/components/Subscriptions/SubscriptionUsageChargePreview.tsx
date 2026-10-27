'use client'

import { InvoicePreview } from '@/components/Orders/InvoicePreview'
import { OrderSection } from '@/components/Orders/OrderSection'
import { useSubscriptionMeterChargePreview } from '@/hooks/queries/subscriptions'
import { billsUsageOnMeterCycle } from '@/utils/subscription'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

const SubscriptionUsageChargePreview = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const meters = subscription.meters.filter((meter) => meter.amount > 0)
  const showsCharge = billsUsageOnMeterCycle(subscription) && meters.length > 0

  const { data: preview } = useSubscriptionMeterChargePreview(subscription.id, {
    enabled: showsCharge,
  })

  if (!showsCharge || !preview) {
    return null
  }

  const chargeDate = subscription.current_meter_period_end

  return (
    <Box
      flexDirection="column"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingTop="4xl"
    >
      <OrderSection
        title="Upcoming usage charge"
        description={
          <Box alignItems="center" columnGap="s">
            <Text color="muted">Next invoice</Text>
            {chargeDate && (
              <>
                <Text color="muted">·</Text>
                <Text color="muted">
                  <FormattedDateTime dateStyle="medium" datetime={chargeDate} />
                </Text>
              </>
            )}
          </Box>
        }
      >
        <InvoicePreview
          currency={subscription.currency}
          items={meters.map((meter) => ({
            id: meter.id,
            label: meter.meter.name,
            amount: meter.amount,
          }))}
          subtotalAmount={preview.subtotal_amount}
          discountAmount={preview.discount_amount}
          netAmount={preview.net_amount}
          taxAmount={preview.tax_amount}
          totalAmount={preview.total_amount}
        />
        <Text color="muted">
          Final amount may vary based on usage until the end of the usage
          period.
        </Text>
      </OrderSection>
    </Box>
  )
}

export default SubscriptionUsageChargePreview
