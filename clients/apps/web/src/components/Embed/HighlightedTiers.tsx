import {
  SubscriptionTier,
  SubscriptionTierPriceRecurringInterval,
} from '@polar-sh/sdk'
import { LogoIcon } from 'polarkit/components/brand'
import { formatCurrencyAndAmount } from 'polarkit/money'
import {
  getRecurringBillingLabel,
  getSubscriptionTierAudience,
  getSubscriptionTierPrice,
} from 'polarkit/subscriptions'
import { getSubscriptionColorByType } from '../Subscriptions/utils'

const HighlightedTier = ({
  tier,
  recurringInterval,
  darkmode,
}: {
  tier: SubscriptionTier
  recurringInterval: SubscriptionTierPriceRecurringInterval
  darkmode: boolean
}) => {
  const audience = getSubscriptionTierAudience(tier.type)
  const price = getSubscriptionTierPrice(tier, recurringInterval)
  const recurringBillingLabel = getRecurringBillingLabel(
    price.recurring_interval,
  )

  return (
    <div
      key={tier.id}
      style={{
        display: 'flex',
        flexBasis: 0,
        flexDirection: 'column',
        gap: 20,
        padding: '20px',
        border: darkmode ? '1px solid #1D1E27' : '1px solid #f4f4f4',
        backgroundColor: darkmode ? '#101116' : '#fff',
        flexGrow: 1,
        flexShrink: 0,
        borderRadius: 24,
        maxWidth: '33%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            fontSize: 12,
            color: darkmode ? '#4C5069' : '#666',
          }}
        >
          {audience}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            color: getSubscriptionColorByType(tier.type),
            fontWeight: '600',
            fontSize: 20,
          }}
        >
          {tier.name}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            fontSize: 32,
          }}
        >
          {formatCurrencyAndAmount(price.price_amount, price.price_currency, 0)}
          <div
            style={{
              fontSize: 14,
              color: darkmode ? '#4C5069' : '#78859B',
              marginBottom: 5,
            }}
          >
            /mo
          </div>
        </div>
        <div
          style={{
            fontSize: 14,
            color: darkmode ? '#4C5069' : '#eee',
          }}
        >
          {recurringBillingLabel}
        </div>
      </div>
      {tier.description && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            lineHeight: '1.6em',
            color: darkmode ? '#8186A4' : '#666',
            fontWeight: '500',
            fontSize: 12,
          }}
        >
          {tier.description}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: '1px',
          backgroundColor: darkmode ? '#1D1E27' : '#eee',
          display: 'flex ',
        }}
      ></div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexGrow: 1,
          color: darkmode ? '#8186A4' : '#666',
        }}
      >
        {tier.benefits?.map((benefit) => (
          <div
            key={benefit.id}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', fontSize: 16 }}>✓</div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                marginTop: 2,
              }}
            >
              {benefit.description}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '8px',
          width: '100%',
          backgroundColor: `${getSubscriptionColorByType(tier.type)}22`,
          borderRadius: 32,
          color: `${getSubscriptionColorByType(tier.type)}`,
          fontWeight: '600',
          fontSize: 13,
        }}
      >
        Subscribe
      </div>
    </div>
  )
}

export const HighlightedTiers = ({
  label,
  tiers,
  recurringInterval,
  darkmode,
}: {
  label: string
  tiers: SubscriptionTier[]
  recurringInterval: SubscriptionTierPriceRecurringInterval
  darkmode: boolean
}) => {
  return (
    <div
      style={{
        display: 'flex',
        color: darkmode ? '#D2D4DF' : '#181a1f',
        backgroundColor: darkmode ? '#0C0D11' /*gray-700*/ : '#F8F9FB',
        width: '840px',
        borderRadius: 32,
        overflow: 'hidden',
        flexDirection: 'column',
        position: 'relative',
        padding: 32,
        gap: 42,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{ display: 'flex', color: darkmode ? '#3381FF' : '#0062FF' }}
        >
          <LogoIcon size={40} />
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: '600',
            display: 'flex',
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 32,
          width: '100%',
        }}
      >
        {tiers.map((tier) => (
          <HighlightedTier
            key={tier.id}
            tier={tier}
            recurringInterval={recurringInterval}
            darkmode={darkmode}
          />
        ))}
      </div>
    </div>
  )
}
