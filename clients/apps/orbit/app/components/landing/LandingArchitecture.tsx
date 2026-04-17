'use client'

import { EventStream } from '../EventStream'
import { VectorField } from '../VectorField'
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
      <div className="p-16 py-16">
        <SectionLabel number="003" label="Architecture" />
        <h2 className="mt-12 text-[clamp(2rem,5vw,4.5rem)] font-normal [font-variation-settings:'opsz'_32] leading-[1.05] text-white">
          Four layers.
          <br />
          One pipeline.
        </h2>
      </div>
      <div className="flex items-end p-16 py-32">
        <p className="max-w-md text-lg leading-snug text-neutral-400">
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
            {i === 1 && <VectorField />}
            {i === 2 && <VolumetricSlices />}
            {i === 3 && <OrbitingSpheres />}
          </div>
          {/* Label */}
          <div className="flex gap-3 border-t border-neutral-800 p-12">
            <span className="font-[family-name:var(--font-geist-mono)] text-base text-neutral-500">
              {l.id}
            </span>
            <div>
              <div className="text-base text-white">{l.name}</div>
              <div className="text-base text-neutral-500">{l.desc}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
)
