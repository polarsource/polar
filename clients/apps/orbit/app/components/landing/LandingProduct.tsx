import { SectionLabel } from './SectionLabel'

/**
 * LandingProduct — product overview in a strict two-column grid with
 * numbered feature list and large display heading.
 */

const FEATURES = [
  { id: '2.1', title: 'Event Ingestion', desc: 'Stream billions of usage events in real time' },
  { id: '2.2', title: 'Metering', desc: 'Aggregate raw events into billable usage' },
  { id: '2.3', title: 'Pricing Models', desc: 'Per-unit, tiered, graduated, package — all built in' },
  { id: '2.4', title: 'Wallets', desc: 'Prepaid balances with automatic drawdown' },
  { id: '2.5', title: 'Invoicing', desc: 'Automated invoices with line-item granularity' },
  { id: '2.6', title: 'Revenue Analytics', desc: 'Real-time MRR, churn, and usage dashboards' },
]

export const LandingProduct = () => (
  <section id="product" className="border-b border-neutral-800">
    <div className="grid grid-cols-2 divide-x divide-neutral-800">
      {/* Left column — heading */}
      <div className="flex flex-col justify-between p-16 py-32">
        <SectionLabel number="002" label="Product" />
        <div className="py-20">
          <h2 className="text-[clamp(2rem,5vw,4.5rem)] font-normal [font-variation-settings:'opsz'_32] leading-[1.05] text-white">
            The full stack
            <br />
            for usage-based
            <br />
            billing
          </h2>
        </div>
        <p className="max-w-sm text-2xl leading-snug">
          A single API that replaces your metering pipeline, billing
          engine, invoice generator, and revenue dashboard.
        </p>
      </div>

      {/* Right column — numbered feature list */}
      <div className="flex flex-col p-16 py-32">
        <div className="mb-12 text-base uppercase text-white">
          Capabilities
        </div>
        <div className="flex flex-1 flex-col">
          {FEATURES.map((f) => (
            <div
              key={f.id}
              className="flex items-baseline justify-between border-b border-neutral-800 py-5"
            >
              <div className="flex items-baseline gap-6">
                <span className="font-[family-name:var(--font-geist-mono)] text-lg text-neutral-200">
                  {f.id}
                </span>
                <span className="text-lg text-neutral-200">{f.title}</span>
              </div>
              <span className="max-w-[45%] text-right text-lg text-neutral-200">
                {f.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
)
