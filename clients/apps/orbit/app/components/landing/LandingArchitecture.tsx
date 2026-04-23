'use client'

import { RadialSpinner } from '../RadialSpinner'
import { ConcentricDraw } from '../ConcentricDraw'
import { GaugeSweep } from '../GaugeSweep'
import { OrbitingSpheres } from '../OrbitingSpheres'
import { SectionHeading } from './SectionHeading'
import { Button } from './Button'

/**
 * LandingArchitecture — heading row + four-column graphic row,
 * one graphic per architecture layer. Each visual alludes to its
 * layer's function.
 */

const LAYERS = [
  { id: '01', name: 'Ingest', desc: 'Stream every call, token, and byte' },
  { id: '02', name: 'Aggregate', desc: 'Raw signals become billable usage' },
  { id: '03', name: 'Quantify', desc: 'Turn consumption into charges' },
  { id: '04', name: 'Charge', desc: 'Invoice, collect & close the loop' },
]

export const LandingArchitecture = () => (
  <section id="architecture">
    {/* Top row — heading */}
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="px-16 py-32">
        <SectionHeading>
          Ingest. Aggregate.
          <br />
          Quantify. Charge.
        </SectionHeading>
      </div>
      <div className="flex flex-col justify-end gap-12 py-32">
        <p className="max-w-xl text-4xl leading-snug text-neutral-900 dark:text-white">
          From the moment a request fires to the moment you get paid — four
          layers, one pipeline, zero glue code.
        </p>
        <div className="flex flex-row items-center gap-x-6">
          <Button href="#">Get Started</Button>
          <Button href="#" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>

    {/* Bottom row — 4 graphics, one per layer */}
    <div className="mx-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
      {LAYERS.map((l, i) => (
        <div
          key={l.id}
          className="dark:bg-dark-900 flex flex-col bg-neutral-50"
        >
          {/* Graphic */}
          <div className="aspect-square w-full">
            {i === 0 && <RadialSpinner />}
            {i === 1 && <GaugeSweep />}
            {i === 2 && <ConcentricDraw />}
            {i === 3 && <OrbitingSpheres />}
          </div>
          {/* Label */}
          <div className="flex flex-col px-12 py-12">
            <div className="flex flex-col gap-2 text-3xl">
              <span className="text-neutral-900 dark:text-neutral-300">
                {l.id} — {l.name}
              </span>
              <span className="dark:text-dark-300 text-neutral-500">
                {l.desc}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
)
