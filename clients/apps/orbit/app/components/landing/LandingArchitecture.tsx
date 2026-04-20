'use client'

import { RadialSpinner } from '../RadialSpinner'
import { ConcentricDraw } from '../ConcentricDraw'
import { GaugeSweep } from '../GaugeSweep'
import { OrbitingSpheres } from '../OrbitingSpheres'
import { SectionLabel } from './SectionLabel'
import { SectionHeading } from './SectionHeading'

/**
 * LandingArchitecture — heading row + four-column graphic row,
 * one graphic per architecture layer. Each visual alludes to its
 * layer's function.
 */

const LAYERS = [
  { id: '01', name: 'Ingest', desc: 'Stream every call, token, and byte' },
  { id: '02', name: 'Measure', desc: 'Aggregate raw signals into usage' },
  { id: '03', name: 'Price', desc: 'Usage meets your pricing logic' },
  { id: '04', name: 'Settle', desc: 'Invoices out, revenue in' },
]

export const LandingArchitecture = () => (
  <section id="architecture" className="border-b border-neutral-800">
    {/* Top row — heading */}
    <div className="grid grid-cols-2 divide-x divide-neutral-800 border-b border-neutral-800">
      <div className="p-16 py-32">
        <SectionLabel number="001" label="Ingestion-based Billing" />
        <SectionHeading className="mt-16">
          Four layers.
          <br />
          One pipeline.
        </SectionHeading>
      </div>
      <div className="flex items-end p-16 py-32">
        <p className="max-w-xl text-3xl leading-snug text-white">
          From the moment a request fires to the moment you get paid — four
          layers, one pipeline, zero glue code.
        </p>
      </div>
    </div>

    {/* Bottom row — 4 graphics, one per layer */}
    <div className="grid grid-cols-2 divide-x divide-y divide-neutral-800 md:grid-cols-4 md:divide-y-0">
      {LAYERS.map((l, i) => (
        <div key={l.id} className="flex flex-col">
          {/* Graphic */}
          <div className="aspect-square w-full">
            {i === 0 && <RadialSpinner />}
            {i === 1 && <GaugeSweep />}
            {i === 2 && <ConcentricDraw />}
            {i === 3 && <OrbitingSpheres />}
          </div>
          {/* Label */}
          <div className="flex items-stretch border-t border-neutral-800">
            <div className="flex w-20 shrink-0 items-center justify-center self-stretch border-r border-neutral-800">
              <span className="font-[family-name:var(--font-mono)] text-lg font-normal text-neutral-300">
                {l.id}
              </span>
            </div>
            <div className="flex flex-col justify-center px-6 py-6">
              <span className="text-base text-white">{l.name}</span>
              <span className="text-base text-neutral-500">{l.desc}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
)
