'use client'

import { useCompassThreads, useDeleteCompassThread } from '@/hooks/queries'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { schemas } from '@polar-sh/client'
import { Spinner, Text } from '@polar-sh/orbit'
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
  // Plain wrappers: revealing the delete button is driven by the row's hover
  // state, which Box's own pseudo-state props can't reach across elements.
  <div className="group relative">
    <button
      type="button"
      className="w-full text-left"
      onClick={() => onSelect(thread.id)}
    >
      <Box
        alignItems="center"
        paddingLeft="m"
        paddingRight="2xl"
        paddingVertical="s"
        borderRadius="m"
        backgroundColor={
          active
            ? { base: 'background-card', hover: 'background-card' }
            : { hover: 'background-secondary' }
        }
        transitionProperty="colors"
        transitionDuration="fast"
        cursor={{ hover: 'pointer' }}
      >
        <Text truncate>{thread.title}</Text>
      </Box>
    </button>
    {/* Sibling of the row button: nested interactive elements break a11y.
        Revealed on hover or keyboard focus so the list isn't a column of
        trash icons. */}
    <span className="absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity duration-150 ease-out group-focus-within:opacity-100 group-hover:opacity-100">
      <button
        type="button"
        aria-label="Delete conversation"
        onClick={() => onDelete(thread.id)}
      >
        <Box
          as="span"
          display="inline-flex"
          color={{ base: 'text-tertiary', hover: 'text-danger' }}
          transitionProperty="colors"
          transitionDuration="fast"
          cursor={{ hover: 'pointer' }}
          alignItems="center"
        >
          <DeleteOutlineRounded style={{ fontSize: '1rem' }} />
        </Box>
      </button>
    </span>
  </div>
)

interface CompassThreadListProps {
  organization: schemas['Organization']
  activeThreadId: string | null
  onSelect: (threadId: string) => void
  onDeleted: (threadId: string) => void
}

/**
 * Stored conversations, grouped by age. The date headings carry the time so
 * no row has to, which buys the titles the full width of the panel.
 *
 * Mounted only while the menu is open, so each open refetches (the cache
 * still paints instantly).
 */
export const CompassThreadList = ({
  organization,
  activeThreadId,
  onSelect,
  onDeleted,
}: CompassThreadListProps) => {
  const { data: threads, isLoading } = useCompassThreads(organization.id)
  const deleteThread = useDeleteCompassThread(organization.id)
  const items = threads?.items ?? []

  const removeThread = (threadId: string) =>
    deleteThread.mutate(threadId, { onSuccess: () => onDeleted(threadId) })

  if (isLoading) {
    return (
      <Box alignItems="center" justifyContent="center" paddingVertical="xl">
        <Spinner />
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
