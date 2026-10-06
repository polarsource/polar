import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PosterCanvas, PosterFrame } from './PosterFrame'

const CENTER = { x: 200, y: 236 }
const HALF_W = 118
const HALF_H = 58
const LAYER_GAP = 44
const LAYERS = 3

/** An isometric plane at a given vertical offset from the stack's centre. */
const plane = (offset: number) =>
  [
    `${CENTER.x},${CENTER.y + offset - HALF_H}`,
    `${CENTER.x + HALF_W},${CENTER.y + offset}`,
    `${CENTER.x},${CENTER.y + offset + HALF_H}`,
    `${CENTER.x - HALF_W},${CENTER.y + offset}`,
  ].join(' ')

/** The stack, literally: three planes, the top one solid. */
export const LabelsPoster = () => (
  <PosterFrame surface="ether" signed>
    <PosterCanvas>
      {Array.from({ length: LAYERS }, (_, i) => {
        const offset = (i - (LAYERS - 1) / 2) * LAYER_GAP
        const top = i === 0
        return (
          <polygon
            key={i}
            points={plane(offset)}
            fill={top ? 'currentColor' : 'none'}
            opacity={top ? 1 : 0.7 - i * 0.2}
          />
        )
      }).reverse()}
    </PosterCanvas>
    <Box
      position="absolute"
      left="none"
      right="none"
      bottom="none"
      flexDirection="column"
      padding={{ base: 'xl', md: '2xl' }}
    >
      <Text variant="heading-s" as="p" color="inherit" leading="tight">
        The whole stack,
      </Text>
      <Text
        variant="heading-s"
        as="p"
        color="inherit"
        wrap="balance"
        leading="tight"
      >
        <Box as="span" opacity={0.6}>
          one integration
        </Box>
      </Text>
    </Box>
  </PosterFrame>
)
