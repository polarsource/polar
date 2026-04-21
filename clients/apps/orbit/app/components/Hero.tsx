'use client'

import { CircularBand } from './CircularBand'

export const Hero = () => {
  return (
    <section className="flex w-full flex-col items-center bg-dark-950 py-24">
      <div className="relative flex aspect-video w-full max-w-7xl items-center justify-center overflow-hidden bg-dark-900">
        {/* Full-bleed background graphic */}
        <div className="absolute inset-0">
          <CircularBand fill />
        </div>

        {/* Title — bottom left */}
        <h1 className="z-10 rounded-tr-xl bg-dark-900 px-6 py-2 text-6xl font-extralight tracking-tight text-white">
          From Inference to Invoice
        </h1>
      </div>
    </section>
  )
}
