import { Hero } from './components/Hero'
import { CircularBand } from './components/CircularBand'
import { SolarBurst } from './components/SolarBurst'
import { Pinwheel } from './components/Pinwheel'
import { VectorField } from './components/VectorField'
import { VolumetricSlices } from './components/VolumetricSlices'
import { OrbitingSpheres } from './components/OrbitingSpheres'

export default function Home() {
  return (
    <div className="flex flex-col items-center bg-black">
      <Hero />
      <div className="w-full max-w-7xl px-8 py-24">
        <div className="grid grid-cols-2 gap-12">
          <CircularBand />
          <SolarBurst />
          <Pinwheel />
          <VectorField />
          <VolumetricSlices />
          <OrbitingSpheres />
        </div>
      </div>
    </div>
  )
}
