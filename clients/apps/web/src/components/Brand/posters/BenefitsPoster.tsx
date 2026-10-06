import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeadline,
  PosterMono,
  PosterRule,
} from './PosterFrame'

const BENEFITS: [string, string][] = [
  ['License keys', 'license_keys'],
  ['File downloads', 'downloadables'],
  ['GitHub access', 'github_repository'],
  ['Discord roles', 'discord'],
  ['Meter credits', 'meter_credit'],
  ['Anything else', 'custom'],
]

/** What a paid order grants, with the type behind each one. */
export const BenefitsPoster = () => (
  <PosterFrame surface="night" signed>
    <PosterBody>
      <Box flexDirection="column">
        <Box justifyContent="between" paddingBottom="s">
          <PosterMono>BENEFITS</PosterMono>
          <PosterMono dim>GRANTED ON PAYMENT</PosterMono>
        </Box>
        {BENEFITS.map(([name, type]) => (
          <Box key={type} flexDirection="column" rowGap="s" paddingTop="s">
            <PosterRule />
            <Box justifyContent="between" alignItems="baseline" columnGap="l">
              <Text variant="heading-xxs" as="span" color="inherit">
                {name}
              </Text>
              <PosterMono dim>{type}</PosterMono>
            </Box>
          </Box>
        ))}
      </Box>
      <PosterHeadline primary="Paid," secondary="and the access follows" />
    </PosterBody>
  </PosterFrame>
)
