import { Box } from '@polar-sh/orbit/Box'
import { SkeletonBar } from './EventDetailSkeleton'

const ROWS = [
  [140, 90],
  [180, 70],
  [120, 100],
  [200, 80],
  [160, 60],
  [110, 90],
  [190, 70],
  [150, 100],
  [130, 80],
  [170, 60],
  [140, 90],
  [180, 70],
]

export const EventLogSkeleton = () => (
  <Box flexDirection="column" aria-busy="true">
    {ROWS.map(([eventWidth, customerWidth], index) => (
      <Box
        key={index}
        alignItems="center"
        gap="l"
        paddingHorizontal="m"
        paddingVertical="s"
        minHeight={37}
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box width={128} flexShrink={0}>
          <SkeletonBar width={104} height={14} />
        </Box>
        <Box flexGrow={2} flexBasis={0} minWidth={120}>
          <SkeletonBar width={eventWidth} height={14} />
        </Box>
        <Box flexGrow={1} flexBasis={0} minWidth={0}>
          <SkeletonBar width={customerWidth} height={14} />
        </Box>
        <Box width={88} flexShrink={0} />
      </Box>
    ))}
  </Box>
)
