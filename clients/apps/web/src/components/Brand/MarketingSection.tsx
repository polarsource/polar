import { StaticImage } from '@/components/Image/StaticImage'
import React from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import { Label } from './primitives'

interface MarketingSample {
  src: string
  alt: string
  caption: string
  // 'wide' spans both columns; default occupies one.
  wide?: boolean
}

const samples: MarketingSample[] = [
  {
    src: '/assets/brand/marketing/billboard_02.jpg',
    alt: "Polar billboard reading 'Your best customer is losing you money. Polar shows you which one.'",
    caption: 'Out-of-home, cost insights',
  },
  {
    src: '/assets/brand/marketing/billboard_01.jpg',
    alt: "Polar billboard reading 'Your customers 10x'd their usage overnight. Polar already invoiced for it.'",
    caption: 'Out-of-home, usage billing',
  },
]

export function MarketingSection() {
  return (
    <BrandSection
      meta={brandSections[5]}
      title="The brand in the wild"
      lead="Selected campaigns and marketing surfaces, showing the system applied across real touchpoints."
    >
      {samples.length === 0 ? (
        <div className="bg-brand-raised flex aspect-[16/9] w-full items-center justify-center">
          <Label>Marketing samples coming soon</Label>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {samples.map((sample) => (
            <figure
              key={sample.src}
              className={`flex flex-col gap-4 ${sample.wide ? 'md:col-span-2' : ''}`}
            >
              <div className="bg-brand-raised relative aspect-[4/3] w-full overflow-hidden">
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
    </BrandSection>
  )
}
