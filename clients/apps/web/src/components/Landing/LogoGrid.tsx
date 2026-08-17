import { Grid, GridItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { JSX } from 'react'
import { Confidence, FastAPICloud, StillaAIWordmark, Tailwind } from './Logos'

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
    link: 'https://stilla.ai',
  },
]

export const LogoGrid = () => (
  <Grid
    templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }}
    gap="l"
  >
    {LOGOS.map((logo) => (
      <GridItem key={logo.link}>
        <a
          href={logo.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full"
        >
          <Box
            width="100%"
            alignItems="center"
            justifyContent="center"
            aspectRatio="1 / 1"
            paddingHorizontal="xl"
            backgroundColor={{
              base: 'background-secondary',
              hover: 'background-card',
            }}
            transitionDuration="fast"
            transitionProperty="colors"
          >
            <div className="flex w-full items-center justify-center [&_svg]:max-w-full">
              {logo.icon}
            </div>
          </Box>
        </a>
      </GridItem>
    ))}
  </Grid>
)
