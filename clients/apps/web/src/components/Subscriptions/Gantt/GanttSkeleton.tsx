import { SkeletonBar } from '@/components/Shared/SkeletonBar'
import { DAY_MS, type TimelineRange } from '@/utils/subscriptionTimeline'
import { Box } from '@polar-sh/orbit/Box'
import { BAR_HEIGHT, BAR_TOP, ROW_HEIGHT, type GanttScale } from './scale'

const ROWS = [
  { name: 132, product: 96, startedDaysAgo: 24 },
  { name: 104, product: 84, startedDaysAgo: 210 },
  { name: 148, product: 100, startedDaysAgo: 66 },
  { name: 92, product: 76, startedDaysAgo: 340 },
  { name: 120, product: 92, startedDaysAgo: 12 },
  { name: 140, product: 80, startedDaysAgo: 150 },
  { name: 110, product: 96, startedDaysAgo: 95 },
  { name: 128, product: 72, startedDaysAgo: 270 },
]

const skeletonRows = (count: number) =>
  Array.from({ length: count }, (_, index) => ROWS[index % ROWS.length])

// Rows shaped like the real ones, so loaded data replaces them in place.
export const GanttSkeletonLabels = ({ count }: { count: number }) =>
  skeletonRows(count).map((row, index) => (
    <Box
      key={index}
      height={ROW_HEIGHT}
      flexShrink={0}
      alignItems="center"
      gap="s"
      px="l"
      aria-hidden
    >
      <SkeletonBar width={row.name} height={10} />
      <SkeletonBar width={row.product / 2} height={8} />
    </Box>
  ))

interface GanttSkeletonTrackProps {
  count: number
  scale: GanttScale
  rendered: TimelineRange
  now: number
}

export const GanttSkeletonTrack = ({
  count,
  scale,
  rendered,
  now,
}: GanttSkeletonTrackProps) =>
  skeletonRows(count).map((row, index) => (
    <Box
      key={index}
      position="relative"
      height={ROW_HEIGHT}
      flexShrink={0}
      aria-hidden
    >
      <Box
        position="absolute"
        top={BAR_TOP}
        left={scale.x(now - row.startedDaysAgo * DAY_MS)}
        width={scale.span(now - row.startedDaysAgo * DAY_MS, rendered.end)}
      >
        <div className="w-full animate-pulse">
          <Box
            height={BAR_HEIGHT}
            borderRadius="s"
            backgroundColor="background-card"
          />
        </div>
      </Box>
    </Box>
  ))
