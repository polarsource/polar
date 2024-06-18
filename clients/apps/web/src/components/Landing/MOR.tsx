'use client'

import {
  AccountBalanceOutlined,
  ReceiptLongOutlined,
  TrendingUpOutlined,
} from '@mui/icons-material'
import FeatureItem from './molecules/FeatureItem'

export const MerchantOfRecord = () => {
  return (
    <div className="flex flex-col gap-y-24">
      <div className="flex flex-col gap-y-4">
        <h2 className="text-4xl leading-snug md:text-5xl">
          Increase sales, not overhead
        </h2>
        <h3 className="dark:text-polar-600 text-4xl leading-snug text-gray-500">
          Polar handles VAT, sales tax and billing so you don&apos;t have to.
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <FeatureItem
          className="md:col-span-2 md:row-span-2"
          icon={<TrendingUpOutlined />}
          title="Sales Metrics"
          description="Professional funding, sales and subscription metrics. Your dashboard can be plotted down to each hour - let's aim high, together."
          link="#"
          showLink={false}
        >
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet={`/assets/landing/sales_dark.png`}
            />
            <img
              className="dark:border-polar-700 rounded-2xl border border-gray-100"
              srcSet={`/assets/landing/sales.png`}
              alt="Showing metric dashboard within Polar"
            />
          </picture>
        </FeatureItem>
        <FeatureItem
          icon={<ReceiptLongOutlined />}
          title="Merchant of Record"
          description="No more VAT headache - we handle the necessary taxes for you."
          className="md:col-span-1"
          link="/docs/overview/payments-taxes#taxes"
        />
        <FeatureItem
          icon={<AccountBalanceOutlined />}
          title="Payouts"
          description="Withdraw your earnings with ease. Supporting Stripe & Open Collective."
          link="/docs/overview/payments-taxes"
        />
      </div>
    </div>
  )
}
