import { Grid, GridItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { JSX } from 'react'
import {
  Confidence,
  FastAPICloud,
  MiddayWordmark,
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
    icon: <Confidence size={32} />,
    link: 'https://confidence.spotify.com',
  },
  {
    icon: <MiddayWordmark size={32} />,
    link: 'https://midday.ai',
  },
]

export const LogoGrid = () => (
  <Grid
    templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
    gap="l"
  >
    {LOGOS.map((logo) => (
      <GridItem key={logo.link}>
        <Link href={logo.link} target="_blank" className="flex w-full">
          <Box
            width="100%"
            alignItems="center"
            justifyContent="center"
            minHeight={{ base: '7rem', md: '9rem' }}
            backgroundColor={{
              base: 'background-secondary',
              hover: 'background-card',
            }}
            color={{ base: 'text-secondary', hover: 'text-primary' }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            {logo.icon}
          </Box>
        </Link>
      </GridItem>
    ))}
  </Grid>
)
