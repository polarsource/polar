import LogoIcon from '@/components/Brand/LogoIcon'
import { Product, ProductPrice } from '@polar-sh/sdk'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import {
  getRecurringBillingLabel,
} from '../Subscriptions/utils'

export const ProductCard = ({
  product,
  cta,
  darkmode,
}: {
  product: Product
  cta: string
  darkmode: boolean
}) => {
  const price: ProductPrice = product.prices[0]

  const recurringBillingLabel = ('recurring_interval' in price)
    ? getRecurringBillingLabel(price.recurring_interval)
    : ''

  const cover = product.medias.length ? product.medias[0].public_url : null

  return (
    <div
      key={product.id}
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
          {product.name}
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
          {price.amount_type === 'fixed'
            ? formatCurrencyAndAmount(
                price.price_amount,
                price.price_currency,
                0,
              )
            : 'Pay what you want'}
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
      {cover && (
        <img src={cover} style={{ width: '200px', height: '100px' }} alt="" />
      )}
      {product.description && (
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
          {product.description}
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
        {product.benefits?.map((benefit) => (
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
