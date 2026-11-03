import { Grid, GridItem } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
    icon: <Tailwind size={19} />,
    link: 'https://tailwindcss.com',
  },
  {
    icon: <FastAPICloud size={25} />,
    link: 'https://fastapicloud.com',
  },
  {
    icon: <Confidence size={28} />,
    link: 'https://confidence.spotify.com',
  },
  {
    icon: <StillaAIWordmark size={25} />,
    link: 'https://stilla.ai',
  },
  {
    icon: <MiddayWordmark size={31} />,
    link: 'https://midday.ai',
  },
]

const COLUMNS = LOGOS.length

export const LogoGrid = () => (
  <Box display={{ base: 'none', md: 'block' }}>
    <Grid
      templateColumns={{
        base: `repeat(${COLUMNS}, 1fr)`,
        lg: `repeat(${COLUMNS}, max-content)`,
      }}
      justifyContent={{ lg: 'center' }}
      columnGap={{ base: 'l', lg: '4xl', xl: '5xl' }}
      alignItems="center"
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
              opacity={{ base: 0.5, hover: 1 }}
              transitionDuration="fast"
              transitionProperty="opacity"
            >
              <div className="flex w-full items-center justify-center [&_svg]:max-w-full">
                {logo.icon}
              </div>
            </Box>
          </a>
        </GridItem>
      ))}
    </Grid>
  </Box>
)
