'use client'

import { useEffect, useState } from 'react'
import { Hero } from './components/Hero'
import { CircularBand } from './components/CircularBand'
import { SolarBurst } from './components/SolarBurst'
import { Pinwheel } from './components/Pinwheel'
import { VectorField } from './components/VectorField'
import { VolumetricSlices } from './components/VolumetricSlices'

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const imageScene =
  (img: HTMLImageElement): SceneDrawer =>
  (ctx, size) => {
    // Cover-fit the image into the square canvas
    const iw = img.width
    const ih = img.height
    const scale = Math.max(size / iw, size / ih)
    const dw = iw * scale
    const dh = ih * scale
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
  }

export default function Home() {
  const [scenes, setScenes] = useState<SceneDrawer[] | null>(null)

  useEffect(() => {
    Promise.all([loadImage('/portrait-1.png'), loadImage('/portrait-2.png')])
      .then((imgs) => setScenes(imgs.map(imageScene)))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col items-center bg-black">
      <Hero />
      <div className="w-full max-w-7xl px-8 py-24">
        <div className="grid grid-cols-2 gap-12">
          <CircularBand />
          <SolarBurst />
          <Pinwheel />
          <VectorField />
          {scenes && <DotImage scenes={scenes} dotCount={5000} />}
          <VolumetricSlices />
        </div>
      </div>
    </div>
  )
}
