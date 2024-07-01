'use client'

import {
  AccountBalanceOutlined,
  ReceiptLongOutlined,
  TrendingUpOutlined,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import FeatureItem from './molecules/FeatureItem'

export const MerchantOfRecord = () => {
  return (
    <div className="flex flex-col gap-y-24">
      <motion.div
        className="relative flex flex-col gap-y-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1, transition: { duration: 2 } }}
      >
        <picture>
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={`/assets/landing/metrics_dark.png`}
          />
          <img
            className="dark:border-polar-700 rounded-3xl border border-gray-200"
            srcSet={`/assets/landing/metrics.png`}
            alt="Metrics dashboard in Polar"
          />
        </picture>
        <div className="dark:from-polar-950 absolute inset-0 flex flex-col items-center justify-end gap-y-2 bg-gradient-to-t from-white from-30% to-transparent p-6 text-center md:gap-y-8 md:p-12 dark:to-transparent">
          <h2 className="text-2xl leading-snug md:text-5xl">
            Increase sales, not overhead
          </h2>
          <h3 className="dark:text-polar-600 text-xl leading-snug text-gray-300 md:text-4xl">
            Polar handles VAT, sales tax and billing so you don&apos;t have to
          </h3>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <FeatureItem
          icon={<TrendingUpOutlined />}
          title="Sales Metrics"
          description="Professional funding, sales and subscription metrics. Your dashboard can be plotted down to each hour - let's aim high, together."
          link="#"
          showLink={false}
        />
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
