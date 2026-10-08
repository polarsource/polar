import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import LogoType from '../logos/LogoType'
import {
  PosterBody,
  PosterFrame,
  PosterMono,
  PosterSurface,
} from './PosterFrame'

interface Principle {
  numeral: string
  surface: PosterSurface
  backdrop: string
  primary: string
  secondary: string
}

/** Three principles from the ethos page, each set on one of the flow backdrops. */
const PRINCIPLES: Principle[] = [
  {
    numeral: 'I',
    surface: 'night',
    backdrop: '/assets/landing/company/Polar_Flow_01_No_Logo.jpg',
    primary: 'Every number',
    secondary: 'derived from events',
  },
  {
    numeral: 'II',
    surface: 'snow',
    backdrop: '/assets/landing/company/Polar_Flow_02_No_Logo.jpg',
    primary: 'Zero latency',
    secondary: 'by design',
  },
  {
    numeral: 'III',
    surface: 'ether',
    backdrop: '/assets/landing/company/Polar_Flow_03_No_Logo.jpg',
    primary: 'Built for agents,',
    secondary: 'by default',
  },
]

const EthosSheet = ({
  numeral,
  surface,
  backdrop,
  primary,
  secondary,
}: Principle) => (
  <PosterFrame surface={surface} backdrop={backdrop}>
    <PosterBody>
      <Box>
        <LogoType height={20} />
      </Box>
      <Box flexDirection="column" rowGap="l">
        <Box transform="scale(0.85)" transformOrigin="left bottom">
          <PosterMono dim>ETHOS / PRINCIPLE {numeral}</PosterMono>
        </Box>
        <Box flexDirection="column">
          <Text
            variant="heading-s"
            as="p"
            color="inherit"
            wrap="balance"
            leading="tight"
          >
            {primary}
          </Text>
          <Text
            variant="heading-s"
            as="p"
            color="inherit"
            wrap="balance"
            leading="tight"
          >
            <Box as="span" opacity={0.5}>
              {secondary}
            </Box>
          </Text>
        </Box>
      </Box>
    </PosterBody>
  </PosterFrame>
)

export const DerivedPoster = () => <EthosSheet {...PRINCIPLES[0]} />
export const LatencyPoster = () => <EthosSheet {...PRINCIPLES[1]} />
export const AgentsPoster = () => <EthosSheet {...PRINCIPLES[2]} />
