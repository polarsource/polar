import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

// Shades of the inverse color, strongest first, so segments read as one
// series without relying on hue.
const SHADES = [1, 0.6, 0.38, 0.22, 0.12]

export const shade = (index: number) =>
  SHADES[Math.min(index, SHADES.length - 1)]

export interface Segment {
  key: string
  value: number
  danger?: boolean
}

// One bar split into its parts, each as wide as its share of the total.
export const StackedBar = ({ segments }: { segments: Segment[] }) => {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  return (
    <Box height={4} gap="xs">
      {total > 0 ? (
        segments
          .filter((segment) => segment.value > 0)
          .map((segment, index) =>
            segment.danger ? (
              // No Orbit background token is a solid red, so match the charts'.
              <span
                key={segment.key}
                className="h-full bg-red-500"
                style={{ flexGrow: segment.value, flexBasis: 0 }}
              />
            ) : (
              <Box
                key={segment.key}
                height="100%"
                flexGrow={segment.value}
                flexBasis={0}
                backgroundColor="background-inverse"
                opacity={shade(index)}
              />
            ),
          )
      ) : (
        <Box flexGrow={1} backgroundColor="background-card" />
      )}
    </Box>
  )
}

// A legend row for one segment: its swatch, label, share and amount.
export const LegendRow = ({
  index,
  label,
  share,
  value,
}: {
  index: number
  label: string
  share: number
  value: string
}) => (
  <Box justifyContent="between" alignItems="center" gap="m" minWidth={0}>
    <Box alignItems="center" gap="s" minWidth={0}>
      <Box
        width={8}
        height={8}
        flexShrink={0}
        borderRadius="full"
        backgroundColor="background-inverse"
        opacity={shade(index)}
      />
      <Text color="muted" truncate>
        {label}
      </Text>
    </Box>
    <Box alignItems="baseline" gap="s" flexShrink={0}>
      <Text color="muted" tabularNums>
        {Math.round(share * 100)}%
      </Text>
      <Text tabularNums>{value}</Text>
    </Box>
  </Box>
)
