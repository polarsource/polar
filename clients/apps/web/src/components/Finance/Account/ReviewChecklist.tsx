'use client'

import { schemas } from '@polar-sh/client'
import { Box, type BoxProps } from '@polar-sh/orbit/Box'
import { AnimatePresence, motion } from 'framer-motion'
import { ChecklistRow } from './ChecklistRow'

interface Props {
  steps: schemas['OrganizationReviewCheck'][]
  isLoading: boolean
  isExiting: boolean
  rowStagger: number
  rowDuration: number
}

const cardStyles: BoxProps = {
  borderRadius: 'm',
  padding: 'l',
  backgroundColor: 'background-card',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'border-primary',
}

export const ReviewChecklist = ({
  steps,
  isLoading,
  isExiting,
  rowStagger,
  rowDuration,
}: Props) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="s"
      // eslint-disable-next-line polar/no-style-box
      style={{ perspective: 1200 }}
    >
      {isLoading ? (
        Array.from({ length: 8 }, (_, i) => (
          <Box key={`placeholder-${i}`} {...cardStyles}>
            <ChecklistRow isLoading={true} />
          </Box>
        ))
      ) : (
        <AnimatePresence initial={false}>
          {!isExiting &&
            steps.map((step, i) => {
              const exitDelay = (steps.length - 1 - i) * rowStagger
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
                  <Box {...cardStyles}>
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
