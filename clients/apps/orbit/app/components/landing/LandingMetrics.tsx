import { SectionLabel } from './SectionLabel'

/**
 * LandingMetrics — oversized numbers in a horizontal strip with
 * thin vertical dividers. Brutalist data-wall aesthetic.
 */

const METRICS = [
  { value: '99.99%', label: 'Uptime SLA' },
  { value: '<1ms', label: 'Ingestion Latency' },
  { value: '10B+', label: 'Events Processed' },
  { value: '0', label: 'Infrastructure to Manage' },
]

export const LandingMetrics = () => (
  <section className="border-b border-neutral-800">
    <div className="p-8 pb-0">
      <SectionLabel number="004" label="Performance" />
    </div>
    <div className="grid grid-cols-4 divide-x divide-neutral-800">
      {METRICS.map((m) => (
        <div key={m.label} className="flex flex-col gap-3 p-8 py-16">
          <span className="text-[clamp(2.5rem,5vw,5rem)] font-extralight leading-none text-white">
            {m.value}
          </span>
          <span className="text-base uppercase text-white">
            {m.label}
          </span>
        </div>
      ))}
    </div>
  </section>
)
