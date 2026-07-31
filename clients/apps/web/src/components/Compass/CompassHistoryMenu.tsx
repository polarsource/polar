'use client'

import { relativeTime } from '@/components/Chat/time'
import { useCompassThreads, useDeleteCompassThread } from '@/hooks/queries'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import { schemas } from '@polar-sh/client'
import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

interface CompassHistoryMenuProps {
  organization: schemas['Organization']
  activeThreadId: string | null
  onSelect: (threadId: string) => void
  onDeleted: (threadId: string) => void
}

interface ThreadListProps {
  organization: schemas['Organization']
  activeThreadId: string | null
  onSelect: (threadId: string) => void
  onDeleted: (threadId: string) => void
}

/**
 * The panel body. Mounted only while the panel is open, so every open
 * refetches the list — a thread created since the last look shows up without
 * a page refresh (cached data still renders instantly underneath).
 */
const ThreadList = ({
  organization,
  activeThreadId,
  onSelect,
  onDeleted,
}: ThreadListProps) => {
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
      {items.map((thread) => (
        <Box key={thread.id} position="relative">
          <button
            type="button"
            className="w-full text-left"
            onClick={() => onSelect(thread.id)}
          >
            <Box
              flexDirection="column"
              paddingLeft="m"
              paddingRight="2xl"
              paddingVertical="s"
              borderRadius="m"
              backgroundColor={
                thread.id === activeThreadId
                  ? { base: 'background-card', hover: 'background-card' }
                  : { hover: 'background-secondary' }
              }
              transitionProperty="colors"
              transitionDuration="fast"
              cursor={{ hover: 'pointer' }}
            >
              <Text truncate>{thread.title}</Text>
              <Text variant="caption" color="muted">
                {relativeTime(thread.modified_at ?? thread.created_at)}
              </Text>
            </Box>
          </button>
          {/* Sibling, not child, of the row button: nesting interactive
              elements is invalid markup and breaks keyboard navigation. */}
          <Box
            as="span"
            position="absolute"
            right={8}
            top={0}
            bottom={0}
            alignItems="center"
          >
            <button
              type="button"
              aria-label="Delete conversation"
              onClick={() => removeThread(thread.id)}
            >
              <Box
                as="span"
                color={{ base: 'text-tertiary', hover: 'text-danger' }}
                transitionProperty="colors"
                transitionDuration="fast"
                cursor={{ hover: 'pointer' }}
                alignItems="center"
              >
                <DeleteOutlineRounded style={{ fontSize: '1rem' }} />
              </Box>
            </button>
          </Box>
        </Box>
      ))}
    </>
  )
}

/**
 * The conversation history toggle: a header button that opens a small
 * anchored panel of the caller's recent threads. Selecting one rehydrates it
 * into the conversation; there is deliberately no persistent sidebar.
 */
export const CompassHistoryMenu = ({
  organization,
  activeThreadId,
  onSelect,
  onDeleted,
}: CompassHistoryMenuProps) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    // Capture phase so closing the panel wins over the page-level Escape
    // handler, which would otherwise navigate back.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Box alignItems="center" columnGap="xs">
          <HistoryRounded style={{ fontSize: '1rem' }} />
          History
        </Box>
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: -4,
              transition: { duration: 0.12 },
            }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-40 mt-2 w-80"
          >
            <Box
              flexDirection="column"
              backgroundColor="background-primary"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              borderRadius="l"
              boxShadow="xl"
              padding="s"
              maxHeight={400}
              overflowY="auto"
            >
              <ThreadList
                organization={organization}
                activeThreadId={activeThreadId}
                onSelect={(threadId) => {
                  setOpen(false)
                  onSelect(threadId)
                }}
                onDeleted={onDeleted}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
