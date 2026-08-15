import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Chapter } from '../Chapter'
import { Pipeline } from '../Pipeline'

interface Aspect {
  title: string
  desc: string
  href: string
}

const ASPECTS: Aspect[] = [
  {
    title: 'Payment processing',
    desc: 'Cards, wallets, and bank debits captured and settled across 100+ markets.',
    href: '/docs/features/checkout/session',
  },
  {
    title: 'Tax collection & remittance',
    desc: 'Sales tax, VAT, and GST calculated, collected, and filed for you.',
    href: '/docs/merchant-of-record/introduction',
  },
  {
    title: 'Risk & fraud analysis',
    desc: 'Every transaction screened for fraud before it ever hits your books.',
    href: '/docs/merchant-of-record/account-reviews',
  },
  {
    title: 'Refunds & chargebacks',
    desc: 'Disputes, refunds, and usage reconciliation handled end to end.',
    href: '/docs/features/refunds',
  },
]

export const MerchantOfRecord = () => (
  <Chapter
    index="02"
    name="Sell globally"
    title="Polar as the merchant of record"
    subtitle="The liability lands on our name, not yours"
    description="We act as the reseller of your product in over 100 markets. Payments, sales tax, fraud, refunds and chargebacks are our responsibility, never your paperwork."
  >
    <Pipeline />
  </Chapter>
)
