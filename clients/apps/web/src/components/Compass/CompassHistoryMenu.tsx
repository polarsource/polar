'use client'

import HistoryRounded from '@mui/icons-material/HistoryRounded'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CompassIconAction } from './CompassIconAction'
import { CompassThreadList } from './CompassThreadList'

interface CompassHistoryMenuProps {
  organization: schemas['Organization']
  activeThreadId: string | null
  onSelect: (threadId: string) => void
  onDeleted: (threadId: string) => void
}

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
    // Capture phase so Escape closes the panel instead of navigating back.
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
      <CompassIconAction
        label="History"
        expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <HistoryRounded style={{ fontSize: '1.125rem' }} />
      </CompassIconAction>
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
            className="absolute top-full right-0 z-40 mt-2 w-80"
          >
            <Box
              flexDirection="column"
              backgroundColor="background-primary"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              borderRadius="l"
              boxShadow="xl"
              maxHeight={400}
              overflow="hidden"
            >
              <Box
                flexDirection="column"
                paddingHorizontal="s"
                paddingBottom="s"
                overflowY="auto"
              >
                <CompassThreadList
                  organization={organization}
                  activeThreadId={activeThreadId}
                  onSelect={(threadId) => {
                    setOpen(false)
                    onSelect(threadId)
                  }}
                  onDeleted={onDeleted}
                />
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
