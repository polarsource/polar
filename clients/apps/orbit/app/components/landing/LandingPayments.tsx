import { SectionLabel } from './SectionLabel'

/**
 * LandingPayments — asymmetric grid showcasing Polar's checkout,
 * subscription, and SaaS product capabilities. Brutalist cells
 * with thin borders, numbered items, and stark typography.
 */

const CAPABILITIES = [
  {
    title: 'Checkout',
    desc: 'Embeddable, branded checkout flows that convert. Supports cards, wallets, and 135+ currencies out of the box.',
  },
  {
    title: 'Subscriptions',
    desc: 'Recurring billing with trials, upgrades, downgrades, and proration — managed automatically.',
  },
  {
    title: 'One-Time Payments',
    desc: 'Sell digital products, license keys, or pay-per-use credits with a single API call.',
  },
  {
    title: 'Customer Portal',
    desc: 'Self-serve portal where customers manage billing, view invoices, and update payment methods.',
  },
]

export const LandingPayments = () => (
  <section className="border-b border-neutral-800">
    {/* Top row — heading span + intro */}
    <div className="grid grid-cols-2 divide-x divide-neutral-800">
      <div className="p-16 py-32">
        <SectionLabel number="002.B" label="Payments &amp; SaaS" />
        <h2 className="mt-12 text-[clamp(2rem,4.5vw,4rem)] font-normal leading-[1.05] text-white">
          Not just metering.
          <br />
          The complete
          <br />
          commerce layer.
        </h2>
      </div>

      <div className="flex flex-col justify-end p-16 py-32">
        <p className="text-2xl leading-snug">
          Polar is a full payments and billing platform — subscriptions,
          one-time purchases, checkout flows, and customer management —
          built for developers who ship SaaS, APIs, and digital products.
        </p>
      </div>
    </div>

    {/* Bottom row — 4 capability cells */}
    <div className="grid grid-cols-4 divide-x divide-neutral-800 border-t border-neutral-800">
      {CAPABILITIES.map((c, i) => (
        <div key={c.title} className="flex flex-col gap-4 p-16 py-32">
          <span className="font-[family-name:var(--font-mono)] text-base text-neutral-600">
            {String(i + 1).padStart(2, '0')}
          </span>
          <h3 className="text-2xl font-normal text-white">
            {c.title}
          </h3>
          <p className="text-base leading-snug text-neutral-500">
            {c.desc}
          </p>
        </div>
      ))}
    </div>
  </section>
)
