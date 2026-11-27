import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft, ChevronRight } from '@polar-sh/orbit/icons'
import { eachMonthOfInterval, format } from 'date-fns'
import { type TimelineRange } from '@/utils/subscriptionTimeline'
import { type RefObject } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  DATE_LABEL_HEIGHT,
  DATE_LABEL_TOP,
  HEADER_HEIGHT,
  SURFACE_CLASS,
  type GanttScale,
} from './scale'

const MIN_LABEL_WIDTH = 48
const TODAY_WIDTH = 52
const YEAR_WIDTH = 36
// Sits on today while it is in view, then sticks to whichever edge it left by:
// just right of the label column, or just left of the year. It is placed with
// a spacer because a margin would stop it from sticking to the right.
const TODAY_CLASS =
  'group sticky left-[calc(var(--gantt-labels-width)+8px)] right-[68px] z-10 shrink-0 cursor-pointer self-start'
// The arrow points to where today is: the same side the button stuck to.
const ARROW_LEFT_CLASS = 'hidden size-3 group-data-[stuck=left]:block'
const ARROW_RIGHT_CLASS = 'hidden size-3 group-data-[stuck=right]:block'
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
  todayRef: RefObject<HTMLButtonElement | null>
}

export const GanttAxis = ({
  scale,
  rendered,
  now,
  onToday,
  yearRef,
  todayRef,
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
            left={scale.x(month.getTime())}
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
                  left={scale.x(month.getTime())}
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
          <Box flexShrink={0} width={scale.x(now, -TODAY_WIDTH / 2)} />
          <button
            ref={todayRef}
            type="button"
            className={TODAY_CLASS}
            style={{ marginTop: DATE_LABEL_TOP }}
            onClick={onToday}
          >
            <div className="group-data-[stuck=left]:hidden group-data-[stuck=right]:hidden">
              <Box
                width={TODAY_WIDTH}
                height={DATE_LABEL_HEIGHT}
                alignItems="center"
                justifyContent="center"
                borderRadius="s"
                backgroundColor="background-inverse"
              >
                <Text variant="caption" color="inverse" wrap="nowrap">
                  Today
                </Text>
              </Box>
            </div>
            <div className="hidden group-data-[stuck=left]:block group-data-[stuck=right]:block">
              <Box
                height={DATE_LABEL_HEIGHT}
                px="s"
                alignItems="center"
                justifyContent="center"
                gap="xs"
                borderRadius="s"
                backgroundColor="background-card"
                color={{ base: 'text-secondary', hover: 'text-primary' }}
                transitionProperty="colors"
                transitionDuration="fast"
              >
                <ChevronLeft className={ARROW_LEFT_CLASS} />
                <Text variant="label" color="inherit" wrap="nowrap">
                  Today
                </Text>
                <ChevronRight className={ARROW_RIGHT_CLASS} />
              </Box>
            </div>
          </button>
          <div
            className={twMerge(
              'sticky right-0 ml-auto flex items-center pr-4 pl-2',
              SURFACE_CLASS,
            )}
          >
            <Box width={YEAR_WIDTH} justifyContent="end">
              <Text tabularNums>
                <span ref={yearRef} />
              </Text>
            </Box>
          </div>
        </Box>
      </div>
    </>
  )
}
