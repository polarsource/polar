'use client'

import { SectionHeading } from './SectionHeading'
import { Button } from './Button'
import { VectorField } from '../VectorField'

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
  <section id="pricing" className="flex flex-col gap-y-32 py-48">
    <div className="flex flex-col items-center gap-y-8 text-center">
      <SectionHeading className="text-center">
        Built to scale with you.
      </SectionHeading>
      <p className="max-w-4xl text-4xl leading-snug text-balance">
        Start free. Upgrade as you grow. Enterprise needs? Let&apos;s talk.
      </p>
      <div className="flex items-center gap-x-6 pt-4">
        <Button href="#">Get Started</Button>
        <Button href="#" variant="secondary">
          Startup Program
        </Button>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-2 xl:grid-cols-4">
      {TIERS.map((tier) => (
        <div
          key={tier.name}
          className="dark:bg-dark-900 flex flex-col justify-between bg-neutral-50"
        >
          <div className="flex flex-col gap-y-12 p-12">
            <div className="flex flex-col gap-y-8">
              <div className="flex flex-col gap-4">
                <span className="text-4xl text-black dark:text-white">
                  {tier.name}
                </span>

                <p className="dark:text-dark-200 text-2xl text-neutral-500">
                  {tier.desc}
                </p>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-5xl font-normal text-neutral-900 dark:text-white">
                  {tier.free ? 'Free' : tier.price}
                </span>
                {tier.period && (
                  <span className="dark:text-dark-200 text-2xl text-neutral-500">
                    {tier.period}
                  </span>
                )}
              </div>
            </div>

            <div className="dark:border-dark-700 grid grid-cols-1 gap-2 border-t border-neutral-300 pt-8 text-black dark:text-white">
              <div className="dark:text-dark-300 text-xl">Fees</div>
              <ul className="flex flex-col gap-2">
                {tier.fees.map((f) => (
                  <li key={f} className="text-xl">
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="dark:border-dark-700 grid grid-cols-1 gap-2 border-t border-neutral-300 pt-8 text-black dark:text-white">
              <div className="dark:text-dark-300 text-xl">Features</div>
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
            className="dark:bg-dark-800 dark:hover:bg-dark-700 mt-auto block w-full bg-neutral-200 py-5 text-center text-xl font-medium text-neutral-900 transition hover:bg-neutral-300 dark:text-white"
          >
            {tier.cta}
          </a>
        </div>
      ))}
    </div>

    {/* Enterprise */}
    <div className="dark:bg-dark-900 mx-2 grid grid-cols-1 gap-12 bg-neutral-50 p-16 md:grid-cols-4">
      <VectorField field={(r, theta) => theta + Math.PI / 2} />
      <div className="flex flex-col gap-6">
        <h3 className="text-4xl text-black dark:text-white">Enterprise</h3>
        <p className="dark:text-dark-200 max-w-md text-2xl text-neutral-500">
          For organizations with custom requirements, dedicated infrastructure,
          and compliance needs.
        </p>
        <Button href="#" className="mt-4">
          Contact Sales
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-12 gap-y-6">
        {[
          'Unlimited events',
          'Dedicated account manager',
          'Custom SLA guarantee',
          'SSO & RBAC',
          'On-premise deployment',
          'Custom integrations',
          'Priority P0 support',
          'Volume discounts',
        ].map((f) => (
          <span key={f} className="text-xl text-black dark:text-white">
            {f}
          </span>
        ))}
      </div>
    </div>
  </section>
)
