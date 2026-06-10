import { useCustomerSubscriptionChargePreview } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { OverviewSummaryCard } from './OverviewSummaryCard'
import { usePortalTranslations } from './PortalLocaleProvider'

interface CurrentPeriodOverviewProps {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
  api: Client
}

export const CurrentPeriodOverview = ({
  subscription,
  products,
  api,
}: CurrentPeriodOverviewProps) => {
  const t = usePortalTranslations()
  const { data: subscriptionPreview } = useCustomerSubscriptionChargePreview(
    api,
    subscription.id,
  )
  const productId = useMemo(() => {
    if (subscription.pending_update && subscription.pending_update.product_id) {
      return subscription.pending_update.product_id
    }
    return subscription.product_id
  }, [subscription])
  const product = products.find((product) => product.id === productId)

  const isTrialing = subscription.status === 'trialing'
  const isActive = subscription.status === 'active'
  const isCancelingAtPeriodEnd =
    subscription.cancel_at_period_end && !subscription.ended_at

  // Show for active, trialing, or subscriptions set to cancel at period end
  if (!isActive && !isTrialing) {
    return null
  }

  const hasMeters = subscription.meters.length > 0
  const hasTaxes = subscriptionPreview && subscriptionPreview.tax_amount > 0
  const hasDiscount =
    subscriptionPreview && subscriptionPreview.discount_amount > 0

  const isFreeProduct = subscription.prices.some(
    (price) => price.amount_type === 'free',
  )

  // For subscriptions set to cancel, only show if there are meters
  if (isCancelingAtPeriodEnd && !hasMeters) {
    return null
  }

  // Don't show for free subscriptions with no meters
  const hasNextInvoice = !isFreeProduct || hasMeters
  if (!hasNextInvoice) {
    return null
  }

  const chargeDate = isTrialing
    ? subscription.trial_end
    : subscription.current_period_end

  // Determine header and label based on subscription state
  let headerTitle = t('portal.overview.currentPeriod.nextCharge')
  let dateLabel = t('portal.overview.currentPeriod.nextInvoice')

  if (isTrialing) {
    headerTitle = t('portal.overview.currentPeriod.firstChargeAfterTrial')
    dateLabel = t('portal.overview.currentPeriod.trialEnds')
  } else if (isCancelingAtPeriodEnd) {
    headerTitle = t('portal.overview.currentPeriod.finalCharge')
    dateLabel = t('portal.overview.currentPeriod.subscriptionEnds')
  }

  const formattedChargeDate = chargeDate
    ? new Date(chargeDate).toLocaleDateString('en-US', {
        dateStyle: 'medium',
      })
    : t('portal.overview.currentPeriod.notAvailable')

  const chargeDateLabel = t('portal.overview.currentPeriod.dateLabel', {
    label: dateLabel,
    date: formattedChargeDate,
  })

  return (
    <OverviewSummaryCard title={headerTitle} meta={chargeDateLabel}>
      {product && subscriptionPreview && (
        <div className="flex items-center justify-between">
          <span className="dark:text-polar-400 text-gray-600">
            {product.name}
          </span>
          <span
            className={isCancelingAtPeriodEnd ? 'text-gray-500' : 'font-medium'}
          >
            {isCancelingAtPeriodEnd ? (
              t('portal.overview.currentPeriod.canceled')
            ) : (
              <ProductPriceLabel
                product={product}
                currency={subscription.currency}
              />
            )}
          </span>
        </div>
      )}

      {hasMeters && (
        <>
          <span className="font-medium">
            {t('portal.overview.currentPeriod.meteredCharges')}
          </span>

          {subscription.meters.map((meter) => (
            <div key={meter.id} className="flex items-center justify-between">
              <span className="dark:text-polar-400 text-gray-600">
                {meter.meter.name}
              </span>
              <span className="font-medium">
                {formatCurrency('compact')(meter.amount, subscription.currency)}
              </span>
            </div>
          ))}
        </>
      )}

      <div className="dark:border-polar-700 mt-2 border-t border-gray-200 pt-2">
        {(hasTaxes || hasDiscount) && (
          <div className="dark:text-polar-500 mb-1.5 flex items-center justify-between text-gray-500">
            <span>{t('portal.overview.currentPeriod.subtotal')}</span>
            <span>
              {formatCurrency('compact')(
                subscriptionPreview.subtotal_amount,
                subscription.currency,
              )}
            </span>
          </div>
        )}

        {hasDiscount && (
          <div className="dark:text-polar-500 mb-1 flex items-center justify-between text-gray-500">
            <span>{t('portal.overview.currentPeriod.discount')}</span>
            <span>
              {formatCurrency('compact')(
                -1 * subscriptionPreview.discount_amount,
                subscription.currency,
              )}
            </span>
          </div>
        )}

        {hasTaxes && (
          <div className="dark:text-polar-500 mb-1 flex items-center justify-between text-gray-500">
            <span>{t('portal.overview.currentPeriod.taxes')}</span>
            <span>
              {formatCurrency('compact')(
                subscriptionPreview.tax_amount,
                subscription.currency,
              )}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="font-medium">
            {hasMeters
              ? t('portal.overview.currentPeriod.estimatedTotal')
              : t('portal.overview.currentPeriod.total')}
          </span>
          <span className="text-lg font-medium">
            {subscriptionPreview ? (
              formatCurrency('compact')(
                subscriptionPreview.total_amount,
                subscription.currency,
              )
            ) : (
              <span className="dark:text-polar-500 animate-pulse text-gray-500">
                {t('portal.common.loading')}
              </span>
            )}
          </span>
        </div>

        {isCancelingAtPeriodEnd && (
          <p className="max-w-sm text-xs text-gray-500">
            {t('portal.overview.currentPeriod.finalChargeNotice')}
            {hasMeters &&
              ` ${t('portal.overview.currentPeriod.finalChargeMeteredNotice')}`}
          </p>
        )}

        {!isCancelingAtPeriodEnd && hasMeters && (
          <p className="max-w-sm text-xs text-gray-500">
            {isActive
              ? t('portal.overview.currentPeriod.meteredNoticeActive')
              : isTrialing
                ? t('portal.overview.currentPeriod.meteredNoticeTrialing')
                : t('portal.overview.currentPeriod.meteredNoticeDefault')}
          </p>
        )}
      </div>
    </OverviewSummaryCard>
  )
}
