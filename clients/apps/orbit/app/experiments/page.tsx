import { CircularBand } from '../components/CircularBand'
import { ConcentricDraw } from '../components/ConcentricDraw'
import { CreditArc } from '../components/CreditArc'
import { CycleArrow } from '../components/CycleArrow'
import { Dumbbell } from '../components/Dumbbell'
import { GaugeSweep } from '../components/GaugeSweep'
import { LinkedRings } from '../components/LinkedRings'
import { OrbitingSpheres } from '../components/OrbitingSpheres'
import { RadialSpinner } from '../components/RadialSpinner'
import { ShapeGrid } from '../components/ShapeGrid'
import { TextRings } from '../components/TextRings'
import { TileGrid } from '../components/TileGrid'
import { VectorField } from '../components/VectorField'
import { VolumetricSlices } from '../components/VolumetricSlices'
import { WaveBars } from '../components/WaveBars'

const GRAPHICS = [
  { name: 'CircularBand', Component: CircularBand },
  { name: 'ConcentricDraw', Component: ConcentricDraw },
  { name: 'CreditArc', Component: CreditArc },
  { name: 'CycleArrow', Component: CycleArrow },
  { name: 'Dumbbell', Component: Dumbbell },
  { name: 'GaugeSweep', Component: GaugeSweep },
  { name: 'LinkedRings', Component: LinkedRings },
  { name: 'OrbitingSpheres', Component: OrbitingSpheres },
  { name: 'RadialSpinner', Component: RadialSpinner },
  { name: 'ShapeGrid', Component: ShapeGrid },
  { name: 'TextRings', Component: TextRings },
  { name: 'TileGrid', Component: TileGrid },
  { name: 'VectorField', Component: VectorField },
  { name: 'VolumetricSlices', Component: VolumetricSlices },
  { name: 'WaveBars', Component: WaveBars },
]

export default function ExperimentsPage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="mb-12 text-4xl text-neutral-900 dark:text-white">
        Experiments
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GRAPHICS.map(({ name, Component: G }) => (
          <div key={name} className="flex flex-col gap-2">
            <G />
            <span className="dark:text-dark-400 px-2 pb-2 text-base text-neutral-400">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
