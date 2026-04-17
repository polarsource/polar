'use client'

import { EventStream } from '../EventStream'
import { MagneticBubbles } from '../MagneticBubbles'
import { VolumetricSlices } from '../VolumetricSlices'
import { OrbitingSpheres } from '../OrbitingSpheres'
import { SectionLabel } from './SectionLabel'

/**
 * LandingArchitecture — heading row + four-column graphic row,
 * one graphic per architecture layer. Each visual alludes to its
 * layer's function.
 */

const LAYERS = [
  { id: '01', name: 'Events', desc: 'Ingest raw inference logs' },
  { id: '02', name: 'Meters', desc: 'Aggregate into billable usage' },
  { id: '03', name: 'Prices', desc: 'Apply pricing models' },
  { id: '04', name: 'Invoices', desc: 'Generate and deliver' },
]

export const LandingArchitecture = () => (
  <section id="architecture" className="border-b border-neutral-800">
    {/* Top row — heading */}
    <div className="grid grid-cols-2 divide-x divide-neutral-800 border-b border-neutral-800">
      <div className="p-16 py-32">
        <SectionLabel number="003" label="Architecture" />
        <h2 className="mt-16 text-[clamp(2rem,5vw,4.5rem)] font-normal [font-variation-settings:'opsz'_32] leading-[1.05] text-white">
          Four layers.
          <br />
          One pipeline.
        </h2>
      </div>
      <div className="flex items-end p-16 py-32">
        <p className="max-w-md text-2xl leading-snug text-white">
          Every inference event flows through four discrete stages —
          each one observable, configurable, and independently scalable.
        </p>
      </div>
    </div>

    {/* Bottom row — 4 graphics, one per layer */}
    <div className="grid grid-cols-4 divide-x divide-neutral-800">
      {LAYERS.map((l, i) => (
        <div key={l.id} className="flex flex-col">
          {/* Graphic */}
          <div className="aspect-square w-full">
            {i === 0 && <EventStream />}
            {i === 1 && <MagneticBubbles />}
            {i === 2 && <VolumetricSlices />}
            {i === 3 && <OrbitingSpheres />}
          </div>
          {/* Label */}
          <div className="flex items-center gap-3 border-t border-neutral-800 p-12 py-8">
            <span className="font-[family-name:var(--font-mono)] text-lg text-white">
              {l.id}
            </span>
            <span className="text-lg text-white">
              {l.name} — {l.desc}
            </span>
          </div>
        </div>
      ))}
    </div>
  </section>
)
