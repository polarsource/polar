import { TimeRange } from './EventsHistogramControls'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const ZOOM_LEVELS = [
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  12 * HOUR,
  DAY,
  3 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  90 * DAY,
  180 * DAY,
  365 * DAY,
]
const MIN_ZOOM_STEP = 1.5

// Steps to the next zoom level around the current center, never past `bounds`.
// Once the next level exceeds the bounds, it shows all of them.
export const zoomOut = (
  { from, to }: TimeRange,
  bounds: TimeRange,
): TimeRange => {
  const span = to.getTime() - from.getTime()
  const maxSpan = bounds.to.getTime() - bounds.from.getTime()
  const level =
    ZOOM_LEVELS.find((candidate) => candidate >= span * MIN_ZOOM_STEP) ??
    maxSpan
  const target = Math.min(level, maxSpan)
  const center = (from.getTime() + to.getTime()) / 2
  const end = Math.min(bounds.to.getTime(), center + target / 2)
  const start = Math.max(bounds.from.getTime(), end - target)
  return {
    from: new Date(start),
    to: new Date(Math.min(bounds.to.getTime(), start + target)),
  }
}
