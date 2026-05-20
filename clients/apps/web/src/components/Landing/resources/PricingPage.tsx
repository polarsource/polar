'use client'

import { ResourceLayout, ResourceSection } from './ResourceLayout'

export const PricingPage = () => {
  const toc = [
    { id: 'introduction', title: 'Introduction' },
    { id: 'plans', title: 'Plans' },
    { id: 'early-member', title: 'Early Member' },
    { id: 'additional-fees', title: 'Additional Fees' },
    { id: 'example', title: 'Example' },
    { id: 'dispute-fees', title: 'Dispute/Chargeback Fees' },
  ]

  return (
    <ResourceLayout title="Pricing" toc={toc}>
      <ResourceSection id="introduction" title="Introduction">
        <div className="flex flex-col gap-2">
          <h3>Pricing you can read off a page</h3>
          <p>
            Most Merchant of Record providers only offer lower fees through
            opaque, sales-gated &quot;volume discounts&quot;. Polar goes the
            opposite direction: every rate is posted publicly, and you choose
            the plan that fits. No sales process, no negotiations.
          </p>
        </div>
      </ResourceSection>

      <ResourceSection id="plans" title="Plans">
        <div className="flex flex-col gap-4">
          <p>
            Polar offers a free Starter plan plus three optional paid plans
            &ndash; Pro, Growth, and Scale &ndash; that lower your variable rate
            and prioritize your support inquiries. You can switch between plans
            anytime, and your rate adjusts immediately.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <th className="px-4 py-2 text-left">Plan</th>
                  <th className="px-4 py-2 text-left">Monthly fee</th>
                  <th className="px-4 py-2 text-left">Per transaction</th>
                  <th className="px-4 py-2 text-left">Support</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Starter</strong>
                  </td>
                  <td className="px-4 py-2">Free</td>
                  <td className="px-4 py-2">5% + 50¢</td>
                  <td className="px-4 py-2">Standard Support</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Pro</strong>
                  </td>
                  <td className="px-4 py-2">$20 /mo</td>
                  <td className="px-4 py-2">3.8% + 40¢</td>
                  <td className="px-4 py-2">Prioritized Support</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Growth</strong>
                  </td>
                  <td className="px-4 py-2">$100 /mo</td>
                  <td className="px-4 py-2">3.6% + 35¢</td>
                  <td className="px-4 py-2">Prioritized Support</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Scale</strong>
                  </td>
                  <td className="px-4 py-2">$400 /mo</td>
                  <td className="px-4 py-2">3.4% + 30¢</td>
                  <td className="px-4 py-2">Slack + Prioritized Support</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            The paid plans replace the per-transaction Merchant of Record
            premium with a fixed monthly fee and a lower variable rate. As your
            sales grow, the economics flip &ndash; Merchant of Record stops
            being a premium and becomes the cheaper option, with international
            tax compliance, fraud and dispute prevention, and global coverage
            handled for you.
          </p>

          <div className="flex flex-col gap-2">
            <h3 className="text-lg">When does a paid plan pay off?</h3>
            <p>
              Each paid plan crosses over to save you money at a predictable
              monthly sales threshold, so you can decide deliberately rather
              than guess.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <th className="px-4 py-2 text-left">Plan</th>
                  <th className="px-4 py-2 text-left">Breakeven vs. Starter</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Pro</strong>
                  </td>
                  <td className="px-4 py-2">~$1,379 /mo in sales</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Growth</strong>
                  </td>
                  <td className="px-4 py-2">~$5,634 /mo in sales</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Scale</strong>
                  </td>
                  <td className="px-4 py-2">~$19,048 /mo in sales</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            Below your plan&apos;s threshold, a lower tier is the better deal.
            Above it, the paid plan saves money &ndash; and you get faster
            support on top.
          </p>
        </div>
      </ResourceSection>

      <ResourceSection id="early-member" title="Early Member">
        <div className="flex flex-col gap-4">
          <p>
            Organizations created before <strong>May 27, 2026 </strong> stay on
            the Early Member rate indefinitely. This was the rate we offered
            while Polar was catching up on feature parity with other Merchant of
            Record providers, and we&apos;ve committed to honoring it for
            everyone who signed up under it.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <th className="px-4 py-2 text-left">Monthly fee</th>
                  <th className="px-4 py-2 text-left">Per transaction</th>
                  <th className="px-4 py-2 text-left">Subscription fee</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2">Free</td>
                  <td className="px-4 py-2">4% + 40¢</td>
                  <td className="px-4 py-2">+0.5%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-lg">One trade-off worth understanding</h3>
            <p>
              Early Member is yours forever as long as you stay on it. The
              moment you upgrade to a paid plan, Early Member is retired for
              that organization. You can still switch freely between the paid
              plans afterwards, but downgrading to Starter lands you on the new
              5% + 50¢ rate, not your original Early Member rate.
            </p>
          </div>

          <p>
            Organizations created on or after May 27, 2026 start on Starter (5%
            + 50¢). This applies to new organizations even if they&apos;re
            created by customers who signed up earlier.
          </p>
        </div>
      </ResourceSection>

      <ResourceSection id="additional-fees" title="Additional Fees">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg">Transaction extras</h3>
            <ul className="list-inside list-disc space-y-2">
              <li>
                <strong>+1.5% </strong> for international cards (non-US)
              </li>
              <li>
                On the Early Member plan, we impose a <strong>+0.5% </strong>{' '}
                fee for subscription payments. Starter, Pro, Growth, and Scale
                have no separate subscription fee.
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-lg">Payout fees</h3>
            <p>
              While payouts may incur fees charged by our payout providers,
              Polar does not add any extra fees or markup. These are strictly
              Stripe&apos;s fees, and Polar does not profit from them.
            </p>
            <p>
              In addition, Polar offers manual withdrawals for developers,
              keeping you in control of when to issue payouts.
            </p>
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <h4>Stripe</h4>
                <ul className="flex list-inside list-disc flex-col gap-2">
                  <li>$2 per month of active payout(s)</li>
                  <li>0.25% + $0.25 per payout</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h4>Cross border fees (currency conversion)</h4>
                <ul className="flex list-inside list-disc flex-col gap-2">
                  <li>0.25% (EU) - 1% in other countries</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="dark:text-polar-300 dark:bg-polar-800 bg-gray-50 p-4 text-sm text-gray-500">
            We also reserve the right to pass on any other fees Stripe might
            impose in the future.
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="example" title="Example">
        <div className="flex flex-col gap-4">
          <p>
            Let&apos;s look at an example breakdown with the additional fees
            applied. Below is a $30 purchase from Sweden (25% VAT) paid with an
            international card.
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
                <tr className="dark:bg-polar-800 bg-gray-50 font-bold">
                  <td className="px-4 py-2">Total Transaction Value</td>
                  <td className="px-4 py-2">$37.5</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            Here&apos;s how the fees on that $37.5 transaction compare across
            plans.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <th className="px-4 py-2 text-left">Plan</th>
                  <th className="px-4 py-2 text-left">Transaction Fee</th>
                  <th className="px-4 py-2 text-left">International (+1.5%)</th>
                  <th className="px-4 py-2 text-left">Total Fees</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Starter</strong> (5% + 50¢)
                  </td>
                  <td className="px-4 py-2">$2.38</td>
                  <td className="px-4 py-2">$0.56</td>
                  <td className="px-4 py-2">$2.94</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Pro</strong> (3.8% + 40¢)
                  </td>
                  <td className="px-4 py-2">$1.83</td>
                  <td className="px-4 py-2">$0.56</td>
                  <td className="px-4 py-2">$2.39</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Growth</strong> (3.6% + 35¢)
                  </td>
                  <td className="px-4 py-2">$1.70</td>
                  <td className="px-4 py-2">$0.56</td>
                  <td className="px-4 py-2">$2.26</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <strong>Scale</strong> (3.4% + 30¢)
                  </td>
                  <td className="px-4 py-2">$1.58</td>
                  <td className="px-4 py-2">$0.56</td>
                  <td className="px-4 py-2">$2.14</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="dispute-fees" title="Dispute/Chargeback Fees">
        <div className="flex flex-col gap-4">
          <p>
            Sometimes, customers can open a <strong>dispute/chargeback</strong>{' '}
            via their bank for a purchase.{' '}
            <strong>Disputes cost $15 per dispute,</strong> regardless of
            outcome and is deducted from your balance directly. This fee is
            charged by the underlying credit card networks & PSPs regardless of
            outcome and therefore something we cannot refund.
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
    </ResourceLayout>
  )
}
