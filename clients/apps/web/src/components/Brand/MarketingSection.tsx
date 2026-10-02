'use client'

import { StaticImage } from '@/components/Image/StaticImage'
import { Stream } from '@cloudflare/stream-react'
import VolumeOff from '@mui/icons-material/VolumeOff'
import VolumeUp from '@mui/icons-material/VolumeUp'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { Chapter } from '../Landing/Chapter'
import { brandSections } from './brand'

interface MarketingSample {
  src: string
  alt: string
  caption: string
}

const samples: MarketingSample[] = [
  {
    src: '/assets/brand/marketing/lightbox_01.jpg',
    alt: 'Polar logotype on a backlit panel in an office lobby',
    caption: 'Lobby lightbox, logotype',
  },
  {
    src: '/assets/brand/marketing/ledwall_01.jpg',
    alt: 'Polar logotype in black on a large LED wall in a transit hall',
    caption: 'LED wall, logotype',
  },
  {
    src: '/assets/brand/marketing/sign_01.jpg',
    alt: 'Polar mark in white on a black blade sign against a white wall',
    caption: 'Blade sign, mark',
  },
  {
    src: '/assets/brand/marketing/tee_01.jpg',
    alt: 'Black t-shirt with the Polar mark printed in light grey, hanging among leaves',
    caption: 'Apparel, mark',
  },
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
    <Chapter
      id={brandSections[5].id}
      index={brandSections[5].index}
      name={brandSections[5].label}
      title="The brand in the wild"
      subtitle="The system applied across real touchpoints"
    >
      <Box flexDirection="column" rowGap="2xl">
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
          {samples.map((sample) => (
            <Box key={sample.src} flexDirection="column" rowGap="m">
              <Box
                position="relative"
                width="100%"
                aspectRatio="4 / 3"
                overflow="hidden"
                backgroundColor="background-secondary"
              >
                <StaticImage
                  src={sample.src}
                  alt={sample.alt}
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              </Box>
              <Text variant="caption" color="muted">
                {sample.caption}
              </Text>
            </Box>
          ))}
        </Grid>
        <Box flexDirection="column" rowGap="m">
          <Box
            display="block"
            position="relative"
            width="100%"
            overflow="hidden"
            backgroundColor="background-secondary"
          >
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
              className="absolute top-4 right-4 z-10 flex h-16 w-16 cursor-pointer items-center justify-center text-4xl text-white md:top-12 md:right-12 md:text-5xl"
            >
              {muted ? (
                <VolumeOff fontSize="inherit" />
              ) : (
                <VolumeUp fontSize="inherit" />
              )}
            </button>
          </Box>
          <Text variant="caption" color="muted">
            Video, usage billing
          </Text>
        </Box>
      </Box>
    </Chapter>
  )
}
