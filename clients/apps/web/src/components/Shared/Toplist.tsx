import { Text, TextColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { PropsWithChildren, ReactNode } from 'react'

export const ToplistHeader = ({
  title,
  caption,
}: {
  title: ReactNode
  caption?: ReactNode
}) => (
  <Box
    alignItems="baseline"
    columnGap="m"
    paddingBottom="l"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Text variant="body" as="h2">
      {title}
    </Text>
    {caption ? (
      <Text color="muted" variant="body">
        {caption}
      </Text>
    ) : null}
  </Box>
)

// Rows carry `m` horizontal padding for their hover surface; the negative
// margin offsets it so row content aligns with the section title above.
export const Toplist = ({ children }: PropsWithChildren) => (
  <div className="-mx-3">
    <Box as="ul" flexDirection="column">
      {children}
    </Box>
  </div>
)

export interface ToplistItemProps extends PropsWithChildren {
  href?: string
}

export const ToplistItem = ({ href, children }: ToplistItemProps) => {
  const row = (
    <Box
      alignItems="center"
      columnGap="m"
      paddingHorizontal="m"
      paddingVertical="s"
      borderRadius="s"
      backgroundColor={{ hover: 'background-card' }}
      transitionProperty="colors"
      transitionDuration="instant"
    >
      {children}
    </Box>
  )
  return (
    <Box as="li" flexDirection="column">
      {href ? <Link href={href}>{row}</Link> : row}
    </Box>
  )
}

export const ToplistText = ({
  primary,
  secondary,
}: {
  primary: ReactNode
  secondary?: ReactNode
}) => (
  <Box flexDirection="column" flex={1} minWidth={0}>
    <Text truncate>{primary}</Text>
    {secondary ? (
      <Text truncate color="muted" variant="caption">
        {secondary}
      </Text>
    ) : null}
  </Box>
)

export const ToplistValue = ({
  value,
  caption,
  captionColor = 'muted',
}: {
  value: ReactNode
  caption?: ReactNode
  captionColor?: TextColor
}) => (
  <Box flexDirection="column" alignItems="end">
    <Text>{value}</Text>
    {caption ? (
      <Text color={captionColor} variant="caption">
        {caption}
      </Text>
    ) : null}
  </Box>
)

export const ToplistSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="-mx-3 animate-pulse">
    <Box flexDirection="column">
      {Array.from({ length: rows }).map((_, index) => (
        <Box
          key={index}
          alignItems="center"
          columnGap="m"
          paddingHorizontal="m"
          paddingVertical="m"
        >
          <Box
            width={32}
            height={32}
            borderRadius="full"
            backgroundColor="background-card"
            flexShrink={0}
          />
          <Box flexDirection="column" rowGap="xs" flex={1}>
            <Box
              height={14}
              width="40%"
              borderRadius="s"
              backgroundColor="background-card"
            />
            <Box
              height={10}
              width="55%"
              borderRadius="s"
              backgroundColor="background-card"
            />
          </Box>
          <Box flexDirection="column" rowGap="xs" alignItems="end">
            <Box
              height={14}
              width={56}
              borderRadius="s"
              backgroundColor="background-card"
            />
            <Box
              height={10}
              width={40}
              borderRadius="s"
              backgroundColor="background-card"
            />
          </Box>
        </Box>
      ))}
    </Box>
  </div>
)
