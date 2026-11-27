import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft, ChevronRight } from '@polar-sh/orbit/icons'
import { type ReactNode } from 'react'
import { DATE_LABEL_HEIGHT, formatGanttDate } from './scale'

const EDGE_CLASS = 'sticky z-10 hidden shrink-0 cursor-pointer self-center'
// The left one clears the label column, which covers the start of the track,
// and lines up with the Today chip in the header.
const LEFT_CLASS = `${EDGE_CLASS} left-[calc(var(--gantt-labels-width)+8px)] group-data-[out=left]:flex`
const RIGHT_CLASS = `${EDGE_CLASS} right-4 ml-auto group-data-[out=right]:flex`
const ICON_CLASS = 'size-3'

// The same chip as the Today button uses once it sticks to an edge.
const Chip = ({ children }: { children: ReactNode }) => (
  <Box
    height={DATE_LABEL_HEIGHT}
    px="s"
    alignItems="center"
    gap="xs"
    borderRadius="s"
    backgroundColor="background-card"
    color={{ base: 'text-secondary', hover: 'text-primary' }}
    transitionProperty="colors"
    transitionDuration="fast"
  >
    {children}
  </Box>
)

interface GanttRowEdgesProps {
  start: number
  end: number
  now: number
}

// Shown by the row's data-out attribute when its bar is scrolled out of view.
// Clicking one scrolls the timeline to the bar.
export const GanttRowEdges = ({ start, end, now }: GanttRowEdgesProps) => {
  const label = Number.isFinite(end)
    ? `${formatGanttDate(start, now)} to ${formatGanttDate(end, now)}`
    : formatGanttDate(start, now)
  return (
    <>
      <div className={LEFT_CLASS} data-jump={end}>
        <Chip>
          <ChevronLeft className={ICON_CLASS} />
          <Text variant="label" color="inherit" wrap="nowrap" tabularNums>
            {label}
          </Text>
        </Chip>
      </div>
      <div className={RIGHT_CLASS} data-jump={start}>
        <Chip>
          <Text variant="label" color="inherit" wrap="nowrap" tabularNums>
            {label}
          </Text>
          <ChevronRight className={ICON_CLASS} />
        </Chip>
      </div>
    </>
  )
}
