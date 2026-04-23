import { SectionHeading } from './SectionHeading'
import { Button } from './Button'

/**
 * LandingPricing — 4-tier pricing grid with actual Polar tier info.
 */

const TIERS = [
  {
    name: 'Starter',
    free: true,
    desc: 'Free to start & validate ideas.',
    fees: [
      '4.40% + 40¢ per transaction',
      '0.5% per Subscription',
      '$10.00 / 1M Product Events',
    ],
    features: ['All features to sell', '100K Product Events'],
    cta: 'Get Started',
    primary: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    desc: 'For solo entrepreneurs and early teams.',
    fees: [
      '3.80% + 35¢ per transaction',
      '0.0% per Subscription',
      '$6.00 / 1M Product Events',
    ],
    features: [
      'Prioritized Ticket support',
      '1M Product Events',
      'Team permissions',
      'Custom Domain',
    ],
    cta: 'Upgrade Now',
    primary: false,
  },
  {
    name: 'Startup',
    price: '$100',
    period: '/month',
    desc: 'For scaling startups.',
    fees: [
      '3.00% + 30¢ per transaction',
      '0.0% per Subscription',
      '$7.00 / 1M Product Events',
    ],
    features: [
      'P1 Ticket support',
      'Custom Emails',
      '5M Product Events',
      'Advanced Analytics',
    ],
    cta: 'Upgrade Now',
    primary: false,
  },
  {
    name: 'Scale',
    price: '$400',
    period: '/month',
    desc: 'For fast growing businesses.',
    fees: [
      '2.40% + 30¢ per transaction',
      '0.0% per Subscription',
      '$5.00 / 1M Product Events',
    ],
    features: [
      'Slack Channel',
      'Prioritized Ticket support',
      '20M Product Events',
    ],
    cta: 'Upgrade Now',
    primary: false,
  },
]

export const LandingPricing = () => (
  <section id="pricing" className="flex flex-col gap-y-24 py-48">
    <div className="flex flex-col items-center gap-y-8 text-center">
      <SectionHeading className="text-center">
        Pay for what you use.
        <br />
        Scale when you&apos;re ready.
      </SectionHeading>
      <p className="max-w-2xl text-2xl text-neutral-500">
        Start free. Upgrade as you grow. Enterprise needs? Let&apos;s talk.
      </p>
      <div className="flex items-center gap-x-6 pt-4">
        <Button href="#">Get Started Free</Button>
        <Button href="#" variant="secondary">Contact Enterprise</Button>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-2 lg:grid-cols-4">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className="dark:bg-dark-900 flex flex-col justify-between bg-neutral-50"
        >
          <div className="flex flex-col gap-y-12 p-12">
            <div className="flex flex-col gap-y-8">
              <div className="flex items-baseline justify-between">
                <span className="text-4xl text-black dark:text-white">
                  {tier.name}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-normal text-neutral-900 dark:text-white">
                    {tier.free ? 'Free' : tier.price}
                  </span>
                  {tier.period && (
                    <span className="dark:text-dark-200 text-lg text-neutral-500">
                      {tier.period}
                    </span>
                  )}
                </div>
              </div>
              <p className="dark:text-dark-200 text-2xl text-neutral-500">
                {tier.desc}
              </p>
            </div>

            <div className="dark:border-dark-700 grid grid-cols-1 border-t border-neutral-300 pt-8 text-black sm:grid-cols-2 dark:text-white">
              <div className="text-xl">Fees</div>
              <ul className="flex flex-col gap-2">
                {tier.fees.map((f) => (
                  <li key={f} className="text-xl">
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="dark:border-dark-700 grid grid-cols-1 border-t border-neutral-300 pt-8 text-black sm:grid-cols-2 dark:text-white">
              <div className="text-xl">Features</div>
              <ul className="flex flex-col gap-2">
                {tier.features.map((f) => (
                  <li key={f} className="text-xl">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <a
            href="#"
            className={`mt-auto block w-full py-5 text-center text-xl font-medium transition ${
              tier.primary
                ? 'bg-neutral-900 font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200'
                : 'dark:bg-dark-800 dark:hover:bg-dark-700 bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:text-white'
            }`}
          >
            {tier.cta}
          </a>
        </div>
      ))}
    </div>
  </section>
)
