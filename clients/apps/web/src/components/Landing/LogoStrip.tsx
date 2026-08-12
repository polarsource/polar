import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { JSX } from 'react'
import {
  Confidence,
  FastAPICloud,
  MiddayWordmark,
  StillaAIWordmark,
  Tailwind,
} from './Logos'

interface LogoCell {
  icon: JSX.Element
  link: string
}

const LOGOS: LogoCell[] = [
  {
    icon: <Tailwind size={22} />,
    link: 'https://tailwindcss.com',
  },
  {
    icon: <FastAPICloud size={28} />,
    link: 'https://fastapicloud.com',
  },
  {
    icon: <StillaAIWordmark size={28} />,
    link: 'https://stilla.ai',
  },
  {
    icon: <Confidence size={32} />,
    link: 'https://confidence.spotify.com',
  },
  {
    icon: <MiddayWordmark size={32} />,
    link: 'https://midday.ai',
  },
]

export const LogoStrip = () => (
  <Box
    as="section"
    width="100%"
    flexWrap="wrap"
    alignItems="center"
    justifyContent={{ base: 'center', md: 'between' }}
    columnGap="3xl"
    rowGap="xl"
    paddingVertical={{ base: '2xl', md: '3xl' }}
    paddingBottom={{ base: '3xl', md: '4xl' }}
  >
    {LOGOS.map((logo) => (
      <Link key={logo.link} href={logo.link} target="_blank">
        <Box
          opacity={{ base: 0.4, hover: 1 }}
          transitionProperty="opacity"
          transitionDuration="base"
          alignItems="center"
        >
          {logo.icon}
        </Box>
      </Link>
    ))}
  </Box>
)
