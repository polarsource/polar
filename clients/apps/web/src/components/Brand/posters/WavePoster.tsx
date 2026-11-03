import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PosterFrame } from './PosterFrame'

const PHRASE = 'FROM USAGE TO REVENUE'
const ROWS = 16

/** One phrase repeated down the sheet, each row displaced along a sine. */
const rows = Array.from({ length: ROWS }, (_, i) => {
  const phase = (i / ROWS) * Math.PI * 2
  return {
    offset: Math.sin(phase) * 28,
    opacity: 0.35 + ((Math.cos(phase) + 1) / 2) * 0.65,
  }
})

export const WavePoster = () => (
  <PosterFrame surface="ether" signed>
    <Box
      position="absolute"
      inset="none"
      flexDirection="column"
      justifyContent="center"
      rowGap="xs"
      padding={{ base: 'xl', md: '2xl' }}
    >
      {rows.map(({ offset, opacity }, i) => (
        <Box
          key={i}
          opacity={opacity}
          transform={`translateX(${offset}%)`}
          justifyContent="center"
        >
          <Text
            variant="caption"
            as="span"
            color="inherit"
            monospace
            wrap="nowrap"
          >
            {PHRASE}
          </Text>
        </Box>
      ))}
    </Box>
  </PosterFrame>
)
