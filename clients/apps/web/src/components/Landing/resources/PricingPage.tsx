'use client'

import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Link from 'next/link'
import { ResourceLayout, ResourceSection } from './ResourceLayout'

export const PricingPage = () => {
  const toc = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'transaction-fees', title: 'Transaction Fees' },
    { id: 'additional-fees', title: 'Additional Fees' },
    { id: 'example', title: 'Example' },
    { id: 'refunds', title: 'Refunds' },
    { id: 'dispute-fees', title: 'Dispute/Chargeback Fees' },
    { id: 'payout-fees', title: 'Payout Fees' },
    { id: 'volume-pricing', title: 'Volume Pricing' },
  ]

  return (
    <ResourceLayout title="Pricing" toc={toc}>
      <ResourceSection id="introduction" title="Introduction">
        <div className="flex flex-col gap-2">
          <h3>Cheapest MoR on the market</h3>
          <p className="dark:text-polar-300 text-gray-500">
            Polar is priced 20% cheaper than other MoR alternatives. 4% and 40¢
            per transaction.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3>No Hidden Fees</h3>
          <p className="dark:text-polar-300 text-gray-500">
            While payouts may incur fees charged by the payout providers (such
            as Stripe), Polar does not add any extra fees or markup.
          </p>
        </div>
      </ResourceSection>

      <ResourceSection id="transaction-fees" title="Transaction Fees">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">4% + 40¢ per transaction</h3>
          <p className="dark:text-polar-300 text-gray-500">
            Polar is currently built on Stripe, and we cover their 2.9% + 30¢
            fee from ours. However, they impose a few additional fees for
            certain transactions that we need to pass on.
          </p>
        </div>
      </ResourceSection>

      <ResourceSection id="additional-fees" title="Additional Fees">
        <ul className="space-y-2">
          <li>
            <strong>+1.5%</strong> for international cards (non-US)
          </li>
          <li>
            <strong>+0.5%</strong> for subscription payments
          </li>
        </ul>
        <div className="dark:text-polar-300 dark:bg-polar-800 bg-gray-50 p-4 text-sm text-gray-500">
          We also reserve the right to pass on any other fees Stripe might
          impose in the future
        </div>
      </ResourceSection>

      <ResourceSection id="example" title="Example">
        <div className="flex flex-col gap-4">
          <p>
            Let&apos;s look at an example breakdown with all these additional
            fees applied. Below is a payment of a $30 subscription from Sweden
            (25% VAT).
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <tbody>
                <tr>
                  <td className="px-4 py-2">Product Price</td>
                  <td className="px-4 py-2">$30</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">VAT (25%)</td>
                  <td className="px-4 py-2">$7.5</td>
                </tr>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <td className="px-4 py-2">Total Transaction Value</td>
                  <td className="px-4 py-2">$37.5</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Transaction Fee (4% + 40¢)</td>
                  <td className="px-4 py-2">$1.9</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">International Card (+1.5%)</td>
                  <td className="px-4 py-2">$0.56</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Subscription (+0.5%)</td>
                  <td className="px-4 py-2">$0.19</td>
                </tr>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <td className="px-4 py-2">Total Fees (Before Payout)</td>
                  <td className="px-4 py-2">$2.65</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="refunds" title="Refunds">
        <div className="flex flex-col gap-4">
          <p>
            You can issue both full or partial refunds on Polar to your
            customers. However, the initial transaction fees are not refunded to
            you since credit card networks and PSPs charge them regardless of a
            future refund.
          </p>
          <div className="dark:bg-polar-800 bg-gray-50 p-4">
            <p className="dark:text-polar-300 text-sm text-gray-500">
              Polar reserves the right to issue refunds at our own discretion up
              to 60 days after the purchase as part of our efforts to
              continuously and proactively reduce disputes & chargebacks which
              costs you $15/dispute. We only leverage this right for this
              purpose and in the interest of reducing chargebacks and fees for
              you.
            </p>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="dispute-fees" title="Dispute/Chargeback Fees">
        <div className="flex flex-col gap-4">
          <p>
            Sometimes, customers can open a <strong>dispute/chargeback</strong>{' '}
            via their bank for a purchase.{' '}
            <strong>Disputes cost $15 per dispute</strong> regardless of outcome
            and is deducted from your balance directly. This fee is charged by
            the underlying credit card networks & PSPs regardless of outcome and
            therefore something we cannot refund.
          </p>
          <p>
            However, we continuously work to proactively reduce the rate of
            chargebacks across Polar to be at or lower than industry standards.
          </p>
          <p>
            Credit card networks impose monitoring programs, penalties and
            higher chargeback costs for sellers with high chargeback rates
            (~0.7%+). Since Polar is the Merchant of Record, we therefore always
            monitor and proactively prevent our rate coming close to these
            thresholds.
          </p>
          <div className="dark:bg-polar-800 bg-gray-50 p-4">
            <p className="dark:text-polar-300 text-sm text-gray-500">
              Therefore, we might need to intervene and even suspend your
              account unless swift and proactive measures are taken to reduce
              chargebacks to an acceptable industry standard.
            </p>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="payout-fees" title="Payout Fees">
        <div className="flex flex-col gap-4">
          <p>
            While payouts may incur fees charged by the payout providers (such
            as Stripe), Polar does not add any extra fees or markup. These are
            strictly the provider&apos;s fees, and Polar does not profit from
            them.
          </p>
          <p>
            In addition, Polar offers manual withdrawals for developers. Keeping
            you in control of when to issue payouts.
          </p>
          <div className="dark:bg-polar-800 bg-gray-50 p-4">
            <p className="dark:text-polar-300 text-sm text-gray-500">
              Unless you have a Polar balance that you haven&apos;t withdrawn
              for several months, at which point we&apos;ll eventually need to
              trigger a payout on your behalf.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg">Stripe</h3>
              <div className="flex flex-col gap-2 text-sm">
                <p>$2 per month of active payout(s)</p>
                <p>0.25% + $0.25 per payout</p>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <h4 className="dark:text-polar-300 text-gray-500">
                  Cross border fees (currency conversion)
                </h4>
                <p>0.25% (EU) - 1% in other countries</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-lg">Open Collective</h3>
              <p className="text-sm">10% on amount transferred</p>
            </div>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="volume-pricing" title="Volume Pricing">
        <div className="flex flex-col gap-4">
          <p>
            Large or fast-growing business? We can offer custom pricing to
            better fit your needs.
          </p>
          <Link
            href="mailto:support@polar.sh"
            className="w-fit border-b border-black pb-0.5 dark:border-white"
          >
            Reach out to us
            <ArrowOutwardOutlined className="ml-2" fontSize="inherit" />
          </Link>
        </div>
      </ResourceSection>
    </ResourceLayout>
  )
}
