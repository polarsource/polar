'use client'

import { RadialSpinner } from './graphics/RadialSpinner'
import { GaugeSweep } from './graphics/GaugeSweep'
import { OrbitingSpheres } from './graphics/OrbitingSpheres'

const LAYERS = [
  {
    id: '01',
    name: 'Ingest',
    desc: 'Ingest usage & inference on behalf of your users.',
  },
  {
    id: '02',
    name: 'Aggregate',
    desc: 'Transform raw signals into billable usage.',
  },
  {
    id: '03',
    name: 'Charge',
    desc: 'Generate charges & collect payments automatically.',
  },
]

export const Usage = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {LAYERS.map((l, i) => (
      <div key={l.id} className="dark:bg-polar-900 flex flex-col bg-gray-50">
        {/* Graphic */}
        <div className="aspect-square">
          {i === 0 && <RadialSpinner />}
          {i === 1 && <GaugeSweep />}
          {i === 2 && <OrbitingSpheres />}
        </div>
        {/* Label */}
        <div className="flex flex-col px-8 py-8">
          <div className="flex flex-col gap-8">
            <span className="font-display text-2xl text-gray-900 dark:text-white">
              {l.id} — {l.name}
            </span>
            <div className="h-[2px] w-10 bg-indigo-500 dark:bg-indigo-500" />
            <span className="dark:text-polar-500 text-xl text-gray-500">
              {l.desc}
            </span>
          </div>
        </div>
      </div>
    ))}
  </div>
)
