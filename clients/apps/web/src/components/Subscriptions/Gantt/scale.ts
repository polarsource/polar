import { DAY_MS, type TimelineRange } from '@/utils/subscriptionTimeline'
import { format } from 'date-fns'

// Zoom is a fixed scale in pixels per day, not a number of days to fit. That
// way the chart does not rescale when its width changes, for example when the
// detail panel opens beside it.
export const MAX_PIXELS_PER_DAY = 36
export const DEFAULT_PIXELS_PER_DAY = 3

export const ganttGroupValues = [
  'customer',
  'total',
  'product',
  'interval',
] as const

export type GanttGroup = (typeof ganttGroupValues)[number]

export const DEFAULT_GANTT_GROUP: GanttGroup = 'customer'

// Matches a CondensedTable row: 8px of padding around a line, plus its border.
export const ROW_HEIGHT = 38
// Matches the CondensedTable header, so both views share one heading height.
export const HEADER_HEIGHT = 38
// The strip under the timeline and the table, which holds the count.
export const FOOTER_HEIGHT = 44
export const DATE_LABEL_HEIGHT = 22
export const DATE_LABEL_TOP = Math.floor(
  (HEADER_HEIGHT - DATE_LABEL_HEIGHT) / 2,
)
export const BAR_HEIGHT = 16
// Floored so the bar lands on a whole pixel in an odd-height row.
export const BAR_TOP = Math.floor((ROW_HEIGHT - BAR_HEIGHT) / 2)
export const BAR_RADIUS = 4
export const MIN_CYCLE_WIDTH = 6
export const TODAY_VIEWPORT_RATIO = 0.25
export const FALLBACK_VIEWPORT_WIDTH = 960
export const FALLBACK_VIEWPORT_HEIGHT = 800

// Horizontal positions are CSS expressions of this variable, so zooming only
// has to change its value. Nothing is re-rendered while the zoom is dragged.
export const PIXELS_PER_DAY_VAR = '--gantt-pixels-per-day'

// The label column's width. Its default is set where the scroller is styled,
// and anything stuck beside the column is offset by it.
export const LABELS_WIDTH_VAR = '--gantt-labels-width'

// How far past today the navigator strip and the scrollable track always reach.
export const NAVIGATOR_FUTURE_DAYS = 3 * 365

/** The part of the timeline in view, and the scale it is drawn at. */
export interface GanttView {
  start: number
  end: number
  width: number
  pixelsPerDay: number
}

export interface GanttZoomHandle {
  zoomTo: (pixelsPerDay: number) => void
  scrollToToday: () => void
}

export interface GanttScale {
  range: TimelineRange
  /** The value at the last render. It lags behind while the zoom is dragged. */
  pixelsPerDay: number
  width: string
  x: (time: number, offset?: number) => string
  span: (start: number, end: number, inset?: number) => string
}

const scaled = (days: number, offset: number) =>
  `calc(var(${PIXELS_PER_DAY_VAR}) * ${days}px + ${offset}px)`

export const createGanttScale = (
  range: TimelineRange,
  pixelsPerDay: number,
): GanttScale => ({
  range,
  pixelsPerDay,
  width: scaled((range.end - range.start) / DAY_MS, 0),
  x: (time, offset = 0) => scaled((time - range.start) / DAY_MS, offset),
  span: (start, end, inset = 0) =>
    `max(1px, ${scaled((end - start) / DAY_MS, -inset)})`,
})

export const formatGanttDate = (time: number, now: number): string =>
  format(
    time,
    new Date(time).getFullYear() === new Date(now).getFullYear()
      ? 'MMM d'
      : 'MMM d, yyyy',
  )

export const SURFACE_CLASS = 'dark:bg-polar-900 bg-white'
export const ROW_SELECTED_CLASS = 'dark:bg-polar-800 bg-gray-100'
export const ROW_HOVERABLE_CLASS =
  'data-[hovered=true]:bg-gray-50 dark:data-[hovered=true]:bg-polar-800/50'
