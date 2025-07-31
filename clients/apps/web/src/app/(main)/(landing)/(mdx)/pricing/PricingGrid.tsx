import Link from 'next/link'
import PricingCard from './PricingCard'

export default function PricingGrid() {
  return (
    <div className="not-prose space-y-8">
      <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-8 md:max-w-3xl md:grid-cols-2">
        <PricingCard
          title="Transaction fees"
          description="4% + 40¢"
          footer={
            <>
              <p>
                This transaction fee covers Stripe&apos;s processing fee of 2.9%
                + 30¢.
              </p>
              <p>Additional fees from Stripe may be passed on, including:</p>
              <ul>
                <li>+1.5% for international (non-US) cards</li>
                <li>+0.5% for subscription payments</li>
              </ul>
            </>
          }
        />
        <PricingCard
          title="Payout fees"
          description="No extra fees"
          footer={
            <>
              <p>
                Stripe charges $2 per month of active payouts, and 0.25% + $0.25
                per payout.
              </p>

              <p>
                Additionally, cross-border fees for currency conversion of 0.25%
                (EU) or 1% (other countries) will be charged too.
              </p>

              <p>
                This cost will be passed on and Polar does not take any profit
                on them.
              </p>
            </>
          }
        />
      </div>

      <p className="dark:text-polar-600 mx-auto max-w-md text-pretty text-center text-base text-gray-400">
        Large or fast-growing business?{' '}
        <Link
          href="https://docs.polar.sh/support"
          className="dark:hover:text-polar-500 font-medium text-inherit underline decoration-1 underline-offset-2 hover:text-gray-500 hover:no-underline"
        >
          Reach out to us
        </Link>{' '}
        to discuss custom pricing that better fits your needs.
      </p>
    </div>
  )
}
