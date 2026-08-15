import { Grid, GridItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { JSX } from 'react'
import {
  Confidence,
  FastAPICloud,
  MiddayWordmark,
  StillaAI,
  StillaAIWordmark,
  Tailwind,
} from './Logos'

interface LogoCell {
  icon: JSX.Element
  link: string
}

const LOGOS: LogoCell[] = [
  {
    icon: <Tailwind size={28} />,
    link: 'https://tailwindcss.com',
  },
  {
    icon: <FastAPICloud size={36} />,
    link: 'https://fastapicloud.com',
  },
  {
    icon: <Confidence size={36} />,
    link: 'https://confidence.spotify.com',
  },
  {
    icon: <StillaAIWordmark size={36} />,
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
            aspectRatio="1 / 1"
            backgroundColor={{
              base: 'background-secondary',
              hover: 'background-card',
            }}
            transitionDuration="fast"
            transitionProperty="colors"
          >
            {logo.icon}
          </Box>
        </Link>
      </GridItem>
    ))}
  </Grid>
)
