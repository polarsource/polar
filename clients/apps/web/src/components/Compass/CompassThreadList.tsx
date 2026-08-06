'use client'

import { useCompassThreads, useDeleteCompassThread } from '@/hooks/queries'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { schemas } from '@polar-sh/client'
import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { differenceInCalendarDays, isToday, isYesterday } from 'date-fns'

type CompassThread = schemas['CompassThreadSchema']

const BUCKETS = ['Today', 'Yesterday', 'Previous 7 days', 'Earlier'] as const

type Bucket = (typeof BUCKETS)[number]

const bucketOf = (thread: CompassThread): Bucket => {
  const date = new Date(thread.modified_at ?? thread.created_at)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return differenceInCalendarDays(new Date(), date) <= 7
    ? 'Previous 7 days'
    : 'Earlier'
}

interface ThreadRowProps {
  thread: CompassThread
  active: boolean
  onSelect: (threadId: string) => void
  onDelete: (threadId: string) => void
}

const ThreadRow = ({ thread, active, onSelect, onDelete }: ThreadRowProps) => (
  // `group` marks the row for the delete button's reveal; Box pseudo-states
  // are self-scoped, so there is no typed equivalent.
  <div className="group">
    <Box
      alignItems="center"
      columnGap="s"
      paddingLeft="m"
      paddingRight="s"
      paddingVertical="s"
      borderRadius="m"
      backgroundColor={
        active
          ? { base: 'background-card', hover: 'background-card' }
          : { hover: 'background-secondary' }
      }
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onSelect(thread.id)}
      >
        <Text truncate>{thread.title}</Text>
      </button>
      <button
        type="button"
        aria-label={`Delete ${thread.title}`}
        onClick={() => onDelete(thread.id)}
        className="flex shrink-0 items-center justify-center leading-none opacity-0 transition-opacity duration-150 ease-out group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <Box
          as="span"
          display="inline-flex"
          color={{ base: 'text-tertiary', hover: 'text-danger' }}
          transitionProperty="colors"
          transitionDuration="fast"
          cursor={{ hover: 'pointer' }}
        >
          <DeleteOutlineRounded
            style={{ fontSize: '1rem', display: 'block' }}
          />
        </Box>
      </button>
    </Box>
  </div>
)

interface CompassThreadListProps {
  organization: schemas['Organization']
  activeThreadId: string | null
  onSelect: (threadId: string) => void
  onDeleted: (threadId: string) => void
}

export const CompassThreadList = ({
  organization,
  activeThreadId,
  onSelect,
  onDeleted,
}: CompassThreadListProps) => {
  const {
    data: threads,
    isLoading,
    isError,
    refetch,
  } = useCompassThreads(organization.id)
  const deleteThread = useDeleteCompassThread(organization.id)
  const items = threads?.items ?? []

  const removeThread = async (threadId: string) => {
    const { error } = await deleteThread.mutateAsync(threadId)
    if (error) {
      return
    }
    onDeleted(threadId)
  }

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" paddingVertical="xl">
        <Spinner />
      </Box>
    )
  }

  if (isError) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        rowGap="s"
        paddingVertical="xl"
      >
        <Text variant="caption" color="muted">
          Conversations could not be loaded
        </Text>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </Box>
    )
  }

  if (items.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" paddingVertical="xl">
        <Text variant="caption" color="muted">
          No conversations yet
        </Text>
      </Box>
    )
  }

  return (
    <>
      {BUCKETS.map((bucket) => {
        const bucketItems = items.filter((item) => bucketOf(item) === bucket)
        if (bucketItems.length === 0) return null
        return (
          <Box key={bucket} flexDirection="column">
            <Box
              position="sticky"
              top={0}
              zIndex={1}
              backgroundColor="background-primary"
              paddingLeft="m"
              paddingTop="m"
              paddingBottom="xs"
            >
              <Text variant="caption" color="muted">
                {bucket}
              </Text>
            </Box>
            {bucketItems.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                active={thread.id === activeThreadId}
                onSelect={onSelect}
                onDelete={removeThread}
              />
            ))}
          </Box>
        )
      })}
    </>
  )
}
