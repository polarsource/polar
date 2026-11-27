import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type ReactNode } from 'react'

const WIDTH = 280
const SKELETON_ROW_WIDTHS = [64, 48, 88]

// The card sits on a raised panel, where the usual skeleton color is the
// panel's own in dark mode.
export const EntityPreviewSkeletonBar = ({
  width,
  height = 12,
}: {
  width: number
  height?: number
}) => (
  <span
    aria-hidden
    className="dark:bg-polar-700 block animate-pulse rounded-sm bg-gray-100"
    style={{ width, height }}
  />
)

const EntityPreviewSkeleton = () => (
  <Box width={WIDTH} flexDirection="column" aria-busy="true">
    <EntityPreviewSection>
      <Box alignItems="center" justifyContent="between" gap="m" height={20}>
        <EntityPreviewSkeletonBar width={140} height={14} />
        <EntityPreviewSkeletonBar width={56} />
      </Box>
      <Box alignItems="center" height={20}>
        <EntityPreviewSkeletonBar width={96} />
      </Box>
    </EntityPreviewSection>
    <EntityPreviewSection divided>
      {SKELETON_ROW_WIDTHS.map((width, index) => (
        <Box
          key={index}
          alignItems="center"
          justifyContent="between"
          gap="m"
          height={20}
        >
          <EntityPreviewSkeletonBar width={width} />
          <EntityPreviewSkeletonBar width={72} />
        </Box>
      ))}
    </EntityPreviewSection>
  </Box>
)

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
    return <EntityPreviewSkeleton />
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
  <Box alignItems="center" justifyContent="between" gap="m">
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
