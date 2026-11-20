import { SkeletonBar } from '@/components/Shared/SkeletonBar'
import { Box } from '@polar-sh/orbit/Box'

const FIELD_WIDTHS = [220, 140, 60, 120, 160]

export const EventDetailSkeleton = () => (
  <Box flexDirection="column" aria-busy="true">
    <Box flexDirection="column" paddingHorizontal="l" paddingVertical="m">
      {FIELD_WIDTHS.map((width, index) => (
        <Box key={index} alignItems="center" gap="m" minHeight={26}>
          <Box width={84} flexShrink={0}>
            <SkeletonBar width={40} />
          </Box>
          <SkeletonBar width={width} />
        </Box>
      ))}
    </Box>
    <Box
      flexDirection="column"
      gap="s"
      paddingHorizontal="l"
      paddingVertical="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Box alignItems="center" minHeight={24}>
        <SkeletonBar width={64} />
      </Box>
      <SkeletonBar width="100%" height={96} />
    </Box>
  </Box>
)
