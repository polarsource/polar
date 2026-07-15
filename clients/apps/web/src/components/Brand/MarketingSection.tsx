'use client'

import { StaticImage } from '@/components/Image/StaticImage'
import { Stream } from '@cloudflare/stream-react'
import React, { useState } from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import { Label } from './primitives'
import VolumeOff from '@mui/icons-material/VolumeOff'
import VolumeUp from '@mui/icons-material/VolumeUp'
interface MarketingSample {
  src: string
  alt: string
  caption: string
  // 'wide' spans both columns; default occupies one.
  wide?: boolean
}

const samples: MarketingSample[] = [
  {
    src: '/assets/brand/marketing/billboard_01.jpg',
    alt: "Polar billboard reading 'Your customers 10x'd their usage overnight. Polar already invoiced for it.'",
    caption: 'Out-of-home, usage billing',
  },
  {
    src: '/assets/brand/marketing/billboard_02.jpg',
    alt: "Polar billboard reading 'Your best customer is losing you money. Polar shows you which one.'",
    caption: 'Out-of-home, cost insights',
  },
]

export function MarketingSection() {
  const [muted, setMuted] = useState(true)

  return (
    <BrandSection
      meta={brandSections[5]}
      title="The brand in the wild"
      lead="Selected campaigns and marketing surfaces, showing the system applied across real touchpoints."
    >
      {samples.length === 0 ? (
        <div className="bg-brand-raised flex aspect-video w-full items-center justify-center">
          <Label>Marketing samples coming soon</Label>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {samples.map((sample) => (
            <figure
              key={sample.src}
              className={`flex flex-col gap-4 ${sample.wide ? 'md:col-span-2' : ''}`}
            >
              <div className="bg-brand-raised relative aspect-4/3 w-full overflow-hidden">
                <StaticImage
                  src={sample.src}
                  alt={sample.alt}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              </div>
              <Label>{sample.caption}</Label>
            </figure>
          ))}
        </div>
      )}
      <figure className="flex flex-col gap-4">
        <div className="bg-brand-raised relative w-full overflow-hidden">
          <Stream
            src="591d4d347421834ad050551a2566f1d5"
            controls={false}
            autoplay
            muted={muted}
            loop
          />
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            aria-pressed={!muted}
            className="text-brand-foreground absolute top-4 right-4 z-10 flex h-16 w-16 cursor-pointer items-center justify-center text-4xl md:top-12 md:right-12 md:text-5xl"
          >
            {muted ? (
              <VolumeOff fontSize="inherit" />
            ) : (
              <VolumeUp fontSize="inherit" />
            )}
          </button>
        </div>

        <Label>Video, usage billing</Label>
      </figure>
    </BrandSection>
  )
}
