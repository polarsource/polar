import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { eachMonthOfInterval, format } from 'date-fns'
import { type TimelineRange } from '@/utils/subscriptionTimeline'
import { type RefObject } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  DATE_LABEL_HEIGHT,
  HEADER_HEIGHT,
  SURFACE_CLASS,
  type GanttScale,
} from './scale'

const MIN_LABEL_WIDTH = 48
const AVERAGE_MONTH_DAYS = 30.44

const getLabelInterval = (monthWidth: number): number => {
  if (monthWidth >= MIN_LABEL_WIDTH) return 1
  if (monthWidth * 3 >= MIN_LABEL_WIDTH) return 3
  return 12
}

interface GanttAxisProps {
  scale: GanttScale
  rendered: TimelineRange
  now: number
  onToday: () => void
  yearRef: RefObject<HTMLSpanElement | null>
}

export const GanttAxis = ({
  scale,
  rendered,
  now,
  onToday,
  yearRef,
}: GanttAxisProps) => {
  const months = eachMonthOfInterval({
    start: rendered.start,
    end: rendered.end,
  })
  const labelInterval = getLabelInterval(
    scale.pixelsPerDay * AVERAGE_MONTH_DAYS,
  )

  return (
    <>
      <Box position="absolute" inset={0} pointerEvents="none">
        {months.map((month) => (
          <Box
            key={month.getTime()}
            position="absolute"
            top={0}
            bottom={0}
            left={scale.toX(month.getTime())}
            borderLeftWidth={1}
            borderStyle="solid"
            borderColor={
              month.getMonth() === 0 ? 'border-primary' : 'border-secondary'
            }
          />
        ))}
      </Box>
      <div className={twMerge('sticky top-0 z-20 shrink-0', SURFACE_CLASS)}>
        <Box
          position="relative"
          height={HEADER_HEIGHT}
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          {months
            .filter((month) => month.getMonth() % labelInterval === 0)
            .map((month) => {
              const isYearStart = month.getMonth() === 0
              return (
                <Box
                  key={month.getTime()}
                  position="absolute"
                  top={0}
                  bottom={0}
                  left={scale.toX(month.getTime())}
                  pl="s"
                  alignItems="center"
                >
                  <Text
                    variant="caption"
                    color={isYearStart ? 'default' : 'muted'}
                    wrap="nowrap"
                    tabularNums
                  >
                    {format(month, isYearStart ? 'yyyy' : 'MMM')}
                  </Text>
                </Box>
              )
            })}
          <Box
            position="absolute"
            top={(HEADER_HEIGHT - DATE_LABEL_HEIGHT) / 2}
            left={scale.toX(now)}
            height={DATE_LABEL_HEIGHT}
            transform="translateX(-50%)"
            alignItems="center"
            px="s"
            borderRadius="s"
            backgroundColor="background-inverse"
          >
            <Text variant="caption" color="inverse" wrap="nowrap" tabularNums>
              Today
            </Text>
          </Box>
          <div
            className={twMerge(
              'sticky right-0 ml-auto flex items-center px-2',
              SURFACE_CLASS,
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onToday}
              aria-label="Jump to today"
              title="Jump to today"
            >
              <span ref={yearRef} className="tabular-nums" />
            </Button>
          </div>
        </Box>
      </div>
    </>
  )
}
