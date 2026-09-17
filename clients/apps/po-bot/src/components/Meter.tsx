import { Box } from '@polar-sh/orbit/Box'

/**
 * A thin bar for usage against a limit. Turns red once nothing is left,
 * which is when the gate starts denying calls.
 */
export const Meter = ({
  share,
  spent,
  height = 6,
}: {
  /** Percent of the limit used, 0 to 100. */
  share: number
  spent: boolean
  height?: number
}) => (
  <Box
    className="meter-track"
    height={height}
    borderRadius="full"
    overflow="hidden"
  >
    <Box
      height="100%"
      width={`${share}%`}
      borderRadius="full"
      backgroundColor="background-inverse"
      transitionProperty="all"
      transitionDuration="slow"
      style={spent ? { backgroundColor: 'var(--destructive)' } : undefined}
    />
  </Box>
)
