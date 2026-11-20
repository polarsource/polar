import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MigrationSource, SOURCE_LABELS } from './sources'
import { StripeMark } from './StripeMark'

const INITIALS: Record<MigrationSource, string> = {
  stripe: 'S',
  lemon_squeezy: 'LS',
  paddle: 'P',
}

export function SourceMark({
  source,
  size,
}: {
  source: MigrationSource
  size: number
}) {
  if (source === 'stripe') {
    return <StripeMark size={size} />
  }
  return (
    <Box
      width={size}
      height={size}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      borderRadius="s"
      backgroundColor="background-inverse"
      role="img"
      aria-label={SOURCE_LABELS[source]}
    >
      <Text as="span" color="inverse" variant="caption">
        {INITIALS[source]}
      </Text>
    </Box>
  )
}
