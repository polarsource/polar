import { schemas } from '@polar-sh/client'
import { eachDayOfInterval, startOfDay } from 'date-fns'

export type DayGroup =
  | { type: 'empty-range'; startDate: Date; endDate: Date }
  | { type: 'day'; date: Date; events: schemas['Event'][] }

export function groupEventsByDay(
  events: schemas['Event'][],
): Map<string, schemas['Event'][]> {
  const grouped = new Map<string, schemas['Event'][]>()

  events.forEach((event) => {
    const eventDate = startOfDay(new Date(event.timestamp))
    const dateKey = eventDate.toISOString().split('T')[0]

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, [])
    }
    grouped.get(dateKey)!.push(event)
  })

  return grouped
}

export function generateDateRange(startDate: Date, endDate: Date): Date[] {
  const dates = eachDayOfInterval({
    start: startOfDay(startDate),
    end: startOfDay(endDate),
  })
  return dates.reverse()
}

export function groupEmptyDates(
  dates: Date[],
  eventsMap: Map<string, schemas['Event'][]>,
): DayGroup[] {
  const groups: DayGroup[] = []
  let emptyRangeStart: Date | null = null
  let emptyRangeEnd: Date | null = null

  dates.forEach((date, index) => {
    const dateKey = date.toISOString().split('T')[0]
    const events = eventsMap.get(dateKey) || []

    if (events.length === 0) {
      if (emptyRangeStart === null) {
        emptyRangeStart = date
      }
      emptyRangeEnd = date

      if (index === dates.length - 1) {
        groups.push({
          type: 'empty-range',
          startDate: emptyRangeStart,
          endDate: emptyRangeEnd,
        })
      }
    } else {
      if (emptyRangeStart !== null && emptyRangeEnd !== null) {
        groups.push({
          type: 'empty-range',
          startDate: emptyRangeStart,
          endDate: emptyRangeEnd,
        })
        emptyRangeStart = null
        emptyRangeEnd = null
      }

      groups.push({
        type: 'day',
        date,
        events,
      })
    }
  })

  return groups
}
