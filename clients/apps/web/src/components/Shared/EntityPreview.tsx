import { SkeletonBar } from '@/components/Shared/SkeletonBar'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type ReactNode } from 'react'

const WIDTH = 280

// The card an entity link shows while it is pointed at. It holds sections,
// and stands in for them until what they show has loaded.
export const EntityPreview = ({
  isLoading,
  isError,
  children,
}: {
  isLoading: boolean
  isError: boolean
  children: ReactNode
}) => {
  if (isError) {
    return (
      <Box width={WIDTH} padding="m">
        <Text color="muted">Could not load this</Text>
      </Box>
    )
  }
  if (isLoading) {
    return (
      <Box width={WIDTH} flexDirection="column" gap="s" padding="m">
        <SkeletonBar width={160} height={14} />
        <SkeletonBar width={100} height={12} />
      </Box>
    )
  }
  return (
    <Box width={WIDTH} flexDirection="column">
      {children}
    </Box>
  )
}

// Sections after the first are set apart by a line.
export const EntityPreviewSection = ({
  divided = false,
  children,
}: {
  divided?: boolean
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    gap="xs"
    padding="m"
    borderTopWidth={divided ? 1 : 0}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {children}
  </Box>
)

// A name on the left and something beside it on the right.
export const EntityPreviewTitle = ({
  title,
  aside,
}: {
  title: string
  aside?: ReactNode
}) => (
  <Box alignItems="baseline" justifyContent="between" gap="m">
    <Box minWidth={0}>
      <Text truncate>{title}</Text>
    </Box>
    {aside && (
      <Box flexShrink={0}>
        <Text tabularNums wrap="nowrap">
          {aside}
        </Text>
      </Box>
    )}
  </Box>
)

export const EntityPreviewRow = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <Box alignItems="baseline" justifyContent="between" gap="m">
    <Box flexShrink={0}>
      <Text color="muted">{label}</Text>
    </Box>
    <Box minWidth={0}>
      <Text truncate tabularNums>
        {children}
      </Text>
    </Box>
  </Box>
)
