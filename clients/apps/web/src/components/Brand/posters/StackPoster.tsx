import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PosterFrame, PosterHeader, PosterMono } from './PosterFrame'

const STEPS = [
  { word: 'Meter', opacity: 1 },
  { word: 'Invoice', opacity: 0.6 },
  { word: 'Settle', opacity: 0.35 },
]

/** Rulers grow with the balance they mark, bottom to top. */
const RULERS = ['$8.5760', '$1.0720', '$0.1340', '$0.0168', '$0.0021']

export const StackPoster = () => (
  <PosterFrame surface="night" signed>
    <Box
      position="absolute"
      inset="none"
      flexDirection="column"
      justifyContent="between"
      padding={{ base: 'xl', md: '2xl' }}
    >
      <Box flexDirection="column">
        <PosterHeader />
        <Box flexDirection="column" paddingTop="2xl">
          {STEPS.map(({ word, opacity }) => (
            <Text
              key={word}
              variant="heading-m"
              as="p"
              color="inherit"
              leading="tight"
            >
              <Box as="span" opacity={opacity}>
                {word}
              </Box>
            </Text>
          ))}
        </Box>
      </Box>
      <Box flexDirection="column" rowGap="l">
        {RULERS.map((amount, index) => (
          <Box key={amount} alignItems="end" columnGap="m">
            <Box flex={1} opacity={0.3}>
              <svg width="100%" height={1} aria-hidden>
                <line
                  x1={`${index * 16}%`}
                  y1={0.5}
                  x2="100%"
                  y2={0.5}
                  stroke="currentColor"
                />
              </svg>
            </Box>
            <Box flexShrink={0} width="4.5rem" justifyContent="end">
              <PosterMono dim>{amount}</PosterMono>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  </PosterFrame>
)
