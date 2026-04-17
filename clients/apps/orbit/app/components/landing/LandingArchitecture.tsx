'use client'

import { VolumetricSlices } from '../VolumetricSlices'
import { OrbitingSpheres } from '../OrbitingSpheres'
import { SectionLabel } from './SectionLabel'

/**
 * LandingArchitecture — three-column grid showing the platform's
 * layered architecture. Left: large heading + description.
 * Center: VolumetricSlices graphic. Right: OrbitingSpheres graphic.
 */

const LAYERS = [
  { id: '01', name: 'Events', desc: 'Raw inference logs ingested via a single HTTP endpoint' },
  { id: '02', name: 'Meters', desc: 'Configurable aggregation windows and grouping keys' },
  { id: '03', name: 'Prices', desc: 'Flexible pricing models attached to meters' },
  { id: '04', name: 'Invoices', desc: 'Automatically generated and delivered on your schedule' },
]

export const LandingArchitecture = () => (
  <section id="architecture" className="border-b border-neutral-800">
    <div className="grid grid-cols-3 divide-x divide-neutral-800">
      {/* Left — text */}
      <div className="flex flex-col justify-between p-8 py-16">
        <SectionLabel number="003" label="Architecture" />

        <div className="py-16">
          <h2 className="mb-8 text-[clamp(1.8rem,3.5vw,3rem)] font-extralight leading-[1.1] text-white">
            Four layers.
            <br />
            One pipeline.
          </h2>

          <div className="flex flex-col gap-0">
            {LAYERS.map((l) => (
              <div
                key={l.id}
                className="flex gap-4 border-t border-neutral-800 py-4"
              >
                <span className="font-[family-name:var(--font-geist-mono)] text-base text-neutral-600">
                  {l.id}
                </span>
                <div>
                  <div className="text-2xl text-white">{l.name}</div>
                  <div className="mt-1 text-base text-neutral-500">{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div />
      </div>

      {/* Center — VolumetricSlices */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <VolumetricSlices />
        </div>
      </div>

      {/* Right — OrbitingSpheres */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <OrbitingSpheres />
        </div>
      </div>
    </div>
  </section>
)
