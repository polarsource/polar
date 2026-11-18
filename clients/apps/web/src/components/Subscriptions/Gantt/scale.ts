import { DAY_MS, type TimelineRange } from '@/utils/subscriptionTimeline'
import { format } from 'date-fns'

export const ganttZoomValues = ['3M', '6M', '1Y', '3Y'] as const

export type GanttZoom = (typeof ganttZoomValues)[number]

export const DEFAULT_GANTT_ZOOM: GanttZoom = '1Y'

export const GANTT_ZOOM_DAYS: Record<GanttZoom, number> = {
  '3M': 92,
  '6M': 183,
  '1Y': 365,
  '3Y': 1095,
}

export const ganttGroupValues = [
  'customer',
  'total',
  'product',
  'interval',
] as const

export type GanttGroup = (typeof ganttGroupValues)[number]

export const DEFAULT_GANTT_GROUP: GanttGroup = 'customer'

export const ROW_HEIGHT = 52
export const HEADER_HEIGHT = 56
export const DATE_LABEL_HEIGHT = 22
export const BAR_HEIGHT = 16
export const BAR_RADIUS = 4
export const MIN_CYCLE_WIDTH = 6
export const TODAY_VIEWPORT_RATIO = 0.25
export const FALLBACK_VIEWPORT_WIDTH = 960

export interface GanttScale {
  range: TimelineRange
  pixelsPerDay: number
  width: number
  toX: (time: number) => number
  toTime: (x: number) => number
}

export const createGanttScale = (
  range: TimelineRange,
  pixelsPerDay: number,
): GanttScale => ({
  range,
  pixelsPerDay,
  width: ((range.end - range.start) / DAY_MS) * pixelsPerDay,
  toX: (time) => ((time - range.start) / DAY_MS) * pixelsPerDay,
  toTime: (x) => range.start + (x / pixelsPerDay) * DAY_MS,
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
