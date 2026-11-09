import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode } from 'react'

export const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const SKELETON_ROWS = 5

const ROW_RULE = {
  paddingHorizontal: 's',
  paddingVertical: 's',
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: 'border-secondary',
} as const

// A text line's height, so loaded rows take its place without a jump.
const Placeholder = ({ width }: { width: string }) => (
  <Text>
    <span
      className="dark:bg-polar-800 inline-block h-[0.8em] animate-pulse rounded-sm bg-gray-100 align-middle"
      style={{ width }}
    />
  </Text>
)

const SkeletonRow = () => (
  <Box alignItems="center" justifyContent="between" gap="m" {...ROW_RULE}>
    <Placeholder width="50%" />
    <Placeholder width="48px" />
  </Box>
)

// A short list that opens the event explorer with its filters set.
export const FeatureWidget = ({
  title,
  href,
  loading,
  empty,
  children,
}: {
  title: string
  href: string
  loading: boolean
  empty?: string
  children: ReactNode
}) => (
  <Box flexDirection="column" minWidth={0}>
    <Box
      justifyContent="between"
      alignItems="center"
      paddingHorizontal="s"
      paddingVertical="s"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Text>{title}</Text>
      <Link
        href={href}
        className="flex items-center gap-1 hover:opacity-70"
        aria-label={`${title} in Events`}
      >
        <Text color="muted">Events</Text>
        <ArrowUpRight className="dark:text-polar-500 h-3.5 w-3.5 text-gray-500" />
      </Link>
    </Box>
    {loading ? (
      <Box flexDirection="column">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <SkeletonRow key={index} />
        ))}
      </Box>
    ) : empty ? (
      <Box paddingHorizontal="s" paddingVertical="s">
        <Text color="muted">{empty}</Text>
      </Box>
    ) : (
      <Box flexDirection="column">{children}</Box>
    )}
  </Box>
)

// One line per row, ruled like the compact tables.
export const WidgetRow = ({
  href,
  primary,
  time,
  value,
}: {
  href: string
  primary: string
  time?: string
  value: ReactNode
}) => (
  <Link href={href} className="dark:hover:bg-polar-800/50 hover:bg-gray-50">
    <Box alignItems="center" gap="m" {...ROW_RULE}>
      <Box flexGrow={1} minWidth={0} alignItems="baseline" gap="s">
        <Text truncate>{primary}</Text>
        {time && (
          <Box flexShrink={0}>
            <Text color="muted" tabularNums>
              {time}
            </Text>
          </Box>
        )}
      </Box>
      <Box flexShrink={0} alignItems="baseline" gap="s">
        {value}
      </Box>
    </Box>
  </Link>
)
