'use client'

import { schemas } from '@polar-sh/client'
import { Box, type BoxProps } from '@polar-sh/orbit/Box'
import { AnimatePresence, motion } from 'motion/react'
import { useTheme } from 'next-themes'
import { ChecklistRow } from './ChecklistRow'

interface Props {
  steps: schemas['OrganizationReviewCheck'][]
  isLoading: boolean
  isExiting: boolean
  rowStagger: number
  rowDuration: number
}

export const ReviewChecklist = ({
  steps,
  isLoading,
  isExiting,
  rowStagger,
  rowDuration,
}: Props) => {
  const { resolvedTheme: theme } = useTheme()
  const isDark = theme === 'dark'

  const cardStyles: BoxProps = {
    borderRadius: 'm',
    padding: 'l',
    borderWidth: isDark ? 0 : 1,
    borderStyle: 'solid',
    borderColor: 'border-primary',
    backgroundColor: isDark ? 'background-card' : undefined,
  }

  return (
    <Box
      flexDirection="column"
      rowGap="s"
      // eslint-disable-next-line polar/no-style-box
      style={{ perspective: 1200 }}
    >
      {isLoading ? (
        <Box flexDirection="column" rowGap="s">
          {Array.from({ length: 8 }, (_, i) => (
            <Box display="block" key={`placeholder-${i}`} {...cardStyles}>
              <ChecklistRow isLoading={true} />
            </Box>
          ))}
        </Box>
      ) : (
        <AnimatePresence initial={false}>
          {!isExiting &&
            steps.map((step, index) => {
              const exitDelay = (steps.length - 1 - index) * rowStagger
              return (
                <motion.div
                  key={step.key}
                  style={{ transformOrigin: 'top center' }}
                  exit={{
                    opacity: 0,
                    y: -12,
                    rotateX: -75,
                  }}
                  transition={{
                    duration: rowDuration,
                    delay: exitDelay,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  <Box display="block" {...cardStyles}>
                    <ChecklistRow isLoading={false} step={step} />
                  </Box>
                </motion.div>
              )
            })}
        </AnimatePresence>
      )}
    </Box>
  )
}
