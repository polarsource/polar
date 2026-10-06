import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PosterFrame } from './PosterFrame'

const ROWS: [string, string, string][] = [
  ['evt_01', 'tokens.out', '$0.0024'],
  ['evt_02', 'tokens.in', '$0.0006'],
  ['evt_03', 'image.gen', '$0.0400'],
  ['evt_04', 'tokens.out', '$0.0031'],
  ['evt_05', 'seat.add', '$12.000'],
  ['evt_06', 'tokens.in', '$0.0009'],
  ['evt_07', 'audio.min', '$0.0150'],
  ['evt_08', 'tokens.out', '$0.0027'],
  ['evt_09', 'credit.use', '$0.5000'],
  ['evt_10', 'tokens.out', '$0.0019'],
]

const Row = ({ cells, dim }: { cells: string[]; dim?: boolean }) => (
  <Box
    display="grid"
    gridTemplateColumns="1fr 1.4fr auto"
    columnGap="m"
    opacity={dim ? 0.5 : 1}
  >
    {cells.map((cell, index) => (
      <Text
        key={cell}
        variant="caption"
        as="span"
        color="inherit"
        monospace
        align={index === cells.length - 1 ? 'right' : 'left'}
      >
        {cell}
      </Text>
    ))}
  </Box>
)

/** A receipt of raw events, every line of it billable. */
export const LedgerPoster = () => (
  <PosterFrame surface="night" signed>
    <Box
      position="absolute"
      inset="none"
      flexDirection="column"
      justifyContent="between"
      padding={{ base: 'xl', md: '2xl' }}
      rowGap="xl"
    >
      <Box flexDirection="column" rowGap="s">
        <Row cells={['EVENT', 'METER', 'AMOUNT']} dim />
        {ROWS.map((cells) => (
          <Row key={cells[0]} cells={cells} />
        ))}
      </Box>
      <Box flexDirection="column">
        <Text variant="heading-xxs" as="p" color="inherit" leading="tight">
          Every event
        </Text>
        <Text variant="heading-xxs" as="p" color="inherit" leading="tight">
          <Box as="span" opacity={0.5}>
            accounted for
          </Box>
        </Text>
      </Box>
    </Box>
  </PosterFrame>
)
