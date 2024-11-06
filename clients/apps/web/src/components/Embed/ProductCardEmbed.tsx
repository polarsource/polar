import LogoIcon from '@/components/Brand/LogoIcon'
import { ProductEmbed, ProductPrice } from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import {
  getRecurringBillingLabel,
} from '../Subscriptions/utils'

export const ProductCardEmbed = ({
  embed,
  cta,
  darkmode,
}: {
  embed: ProductEmbed
  cta?: string
  darkmode?: boolean
}) => {
  const price: ProductPrice = embed.price

  const isSubscription = ('recurring_interval' in price)
  const isPWYW = price.amount_type === 'custom'
  const recurringBillingLabel = isSubscription
    ? getRecurringBillingLabel(price.recurring_interval)
    : ''

  if (!cta) {
    cta = isSubscription ? 'Subscribe' : 'Buy'
  }

  const coverUrl = embed.cover ? embed.cover.public_url : null

  let shownDescription = embed.description
  if (shownDescription && shownDescription.length > 100) {
    shownDescription = shownDescription.slice(0, 100) + '...'
  }

  let priceLabel = null
  switch (price.amount_type) {
    case 'free':
      priceLabel = 'Free'
      break;
    case 'custom':
      priceLabel = 'Pay what you want'
      break;
    case 'fixed':
      priceLabel = formatCurrencyAndAmount(
        price.price_amount,
        price.price_currency,
        0,
      )
      break;
  }

  return (
    <div
      key={embed.id}
      style={{
        display: 'flex',
        flexBasis: 0,
        flexDirection: 'column',
        gap: 20,
        padding: '20px',
        width: '250px',
        border: darkmode ? '1px solid #1D1E27' : '1px solid #f4f4f4',
        backgroundColor: darkmode ? '#101116' : '#fff',
        flexGrow: 1,
        flexShrink: 0,
        borderRadius: 24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            color: '#3381FF',
            fontWeight: '600',
            fontSize: 20,
          }}
        >
          {embed.name}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            color: darkmode ? '#4C5069' : '#333333',
            alignItems: 'flex-end',
            gap: 8,
            fontSize: isPWYW ? 20 : 36,
          }}
        >
          {priceLabel}
          <div
            style={{
              fontSize: 14,
              color: darkmode ? '#4C5069' : '#78859B',
              marginBottom: 5,
            }}
          >
            {recurringBillingLabel}
          </div>
        </div>
      </div>
      {coverUrl && (
        <img src={coverUrl} style={{ width: '200px', height: '100px' }} alt="" />
      )}
      {embed.description && (
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
          {shownDescription}
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
        {embed.benefits?.map((benefit) => (
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
          backgroundColor: '#3381FF22',
          borderRadius: 32,
          color: '#3381FF',
          fontWeight: '600',
          fontSize: 13,
          gap: 8,
        }}
      >
        <LogoIcon size={20} />
        {cta}
      </div>
    </div>
  )
}
