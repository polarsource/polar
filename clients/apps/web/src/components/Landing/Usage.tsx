'use client'

import { RadialSpinner } from './graphics/RadialSpinner'
import { GaugeSweep } from './graphics/GaugeSweep'
import { OrbitingSpheres } from './graphics/OrbitingSpheres'

const LAYERS = [
  { id: '01', name: 'Ingest', desc: 'Stream every call, inference & request.' },
  {
    id: '02',
    name: 'Aggregate',
    desc: 'Transform raw signals into billable usage.',
  },
  {
    id: '03',
    name: 'Charge',
    desc: 'Generate invoices and collect payment automatically.',
  },
]

export const Usage = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {LAYERS.map((l, i) => (
      <div key={l.id} className="dark:bg-dark-900 flex flex-col bg-neutral-50">
        {/* Graphic */}
        <div className="aspect-square">
          {i === 0 && <RadialSpinner />}
          {i === 1 && <GaugeSweep />}
          {i === 2 && <OrbitingSpheres />}
        </div>
        {/* Label */}
        <div className="flex flex-col px-8 py-8">
          <div className="flex flex-col gap-4">
            <span className="text-2xl text-neutral-900 dark:text-white">
              {l.id} — {l.name}
            </span>
            <span className="dark:text-dark-300 text-xl text-neutral-500">
              {l.desc}
            </span>
          </div>
        </div>
      </div>
    ))}
  </div>
)
