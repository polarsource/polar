import { SubscriptionTier, SubscriptionTierType } from '@polar-sh/sdk'
import { LogoIcon } from 'polarkit/components/brand'
import { getCentsInDollarString } from 'polarkit/money'
import { getSubscriptionColorByType } from '../Subscriptions/utils'

export const HighlightedTiers = ({
  label,
  tiers,
  darkmode,
}: {
  label: string
  tiers: SubscriptionTier[]
  darkmode: boolean
}) => {
  const getSubscriptionTierAudience = (type?: SubscriptionTier['type']) => {
    switch (type) {
      case SubscriptionTierType.FREE:
        return 'For Anyone'
      case SubscriptionTierType.INDIVIDUAL:
        return 'For Individuals'
      case SubscriptionTierType.BUSINESS:
        return 'For Businesses'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        color: darkmode ? '#D2D4DF' : '#181a1f',
        backgroundColor: darkmode ? '#0C0D11' /*gray-700*/ : '#F8F9FB',
        width: '720px',
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
          gap: 20,
          width: '100%',
        }}
      >
        {tiers.map((tier) => (
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
                {getSubscriptionTierAudience(tier.type)}
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 12,
                fontSize: 32,
              }}
            >
              ${getCentsInDollarString(tier.price_amount)}
              <div
                style={{
                  fontSize: 14,
                  color: darkmode ? '#4C5069' : '#eee',
                  marginTop: 4,
                }}
              >
                /month
              </div>
            </div>
            {tier.description && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  color: darkmode ? '#8186A4' : '#666',
                  fontWeight: '500',
                  fontSize: 14,
                }}
              >
                {tier.description}
              </div>
            )}
            <div
              style={{
                width: '100%',
                height: '1px',
                backgroundColor: darkmode ? '#343748' : '#eee',
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
        ))}
      </div>
    </div>
  )
}
