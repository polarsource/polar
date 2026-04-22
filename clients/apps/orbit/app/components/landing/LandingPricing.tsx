import { SectionHeading } from './SectionHeading'
import { Button } from './Button'

/**
 * LandingPricing — 4-tier pricing grid with actual Polar tier info.
 */

const TIERS = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    desc: 'Free to start & validate ideas.',
    fees: [
      '4.40% + 40¢ per transaction',
      '0.5% Billing',
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
      '0.0% Billing (SaaS Embedded)',
      '$6.00 / 1M Product Events',
    ],
    features: [
      'Prioritized Ticket support',
      '1M Product Events',
      'Team permissions',
      'Custom Domain',
    ],
    cta: 'Start Free Trial',
    primary: true,
  },
  {
    name: 'Startup',
    price: '$100',
    period: '/month',
    desc: 'For scaling startups.',
    fees: [
      '3.00% + 30¢ per transaction',
      '0.0% Billing (SaaS Embedded)',
      '$7.00 / 1M Product Events',
    ],
    features: [
      'P1 Ticket support',
      'Custom Emails',
      '5M Product Events',
      'Advanced Analytics',
    ],
    cta: 'Start Free Trial',
    primary: false,
  },
  {
    name: 'Scale',
    price: '$400',
    period: '/month',
    desc: 'For fast growing businesses.',
    fees: [
      '2.40% + 30¢ per transaction',
      '0.0% Billing (SaaS Embedded)',
      '$5.00 / 1M Product Events',
    ],
    features: ['Slack & Prioritized Ticket support', '20M Product Events'],
    cta: 'Start Free Trial',
    primary: false,
  },
]

export const LandingPricing = () => (
  <section id="pricing" className="py-48">
    <div className="p-16 py-24">
      <SectionHeading>
        Simple, transparent
        <br />
        pricing
      </SectionHeading>
    </div>

    <div className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-2 lg:grid-cols-4">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className="dark:bg-dark-900 flex flex-col justify-between bg-neutral-50"
        >
          <div className="flex flex-col gap-y-4 p-10">
            <div className="text-4xl text-black dark:text-white">
              {tier.name}
            </div>
            <p className="dark:text-dark-200 text-2xl text-neutral-500">
              {tier.desc}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-normal text-neutral-900 dark:text-white">
                {tier.price}
              </span>
              <span className="dark:text-dark-200 text-lg text-neutral-500">
                {tier.period}
              </span>
            </div>

            <div className="dark:border-dark-700 mt-8 border-t border-neutral-200 pt-6">
              <div className="mb-2 text-base text-neutral-400">Fees</div>
              <ul className="flex flex-col gap-2">
                {tier.fees.map((f) => (
                  <li
                    key={f}
                    className="text-lg text-neutral-900 dark:text-neutral-300"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="dark:border-dark-700 mt-8 border-t border-neutral-200 pt-6">
              <div className="mb-2 text-base text-neutral-400">Features</div>
              <ul className="flex flex-col gap-2">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="text-lg text-neutral-900 dark:text-neutral-200"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <a
            href="#"
            className={`mt-auto block w-full py-5 text-center text-lg font-medium transition ${
              tier.primary
                ? 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200'
                : 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-dark-800 dark:text-white dark:hover:bg-dark-700'
            }`}
          >
            {tier.cta}
          </a>
        </div>
      ))}
    </div>
  </section>
)
