import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PosterBody,
  PosterFrame,
  PosterHeadline,
  PosterMono,
  PosterRule,
} from './PosterFrame'

const LINES: { value: string; label: string; dim?: boolean }[] = [
  { value: '1,204,318', label: 'TOKENS' },
  { value: '× 0.002', label: 'USD PER TOKEN', dim: true },
]

/** The whole of usage billing in one sum. */
export const ArithmeticPoster = () => (
  <PosterFrame surface="snow" signed>
    <PosterBody>
      <Box justifyContent="between">
        <PosterMono>USAGE × RATE</PosterMono>
        <PosterMono dim>OCTOBER</PosterMono>
      </Box>
      <Box flexDirection="column" rowGap="l">
        {LINES.map(({ value, label, dim }) => (
          <Box key={label} flexDirection="column">
            <Text variant="heading-m" as="p" color="inherit" tabularNums>
              <Box as="span" opacity={dim ? 0.5 : 1}>
                {value}
              </Box>
            </Text>
            <PosterMono dim>{label}</PosterMono>
          </Box>
        ))}
        <PosterRule />
        <Box flexDirection="column">
          <Text variant="heading-m" as="p" color="inherit" tabularNums>
            $2,408.64
          </Text>
          <PosterMono dim>INVOICED</PosterMono>
        </Box>
      </Box>
      <PosterHeadline primary="Usage in" secondary="invoice out" />
    </PosterBody>
  </PosterFrame>
)
