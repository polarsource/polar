'use client'

import { fromISODate } from '@/utils/metrics'
import { endOfDay, startOfDay } from 'date-fns'
import { createParser } from 'nuqs'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Links from elsewhere pass plain dates; read them as local days rather than
// UTC midnight, which lands on the previous day west of UTC.
const parseAsDay = (edge: (date: Date) => Date) =>
  createParser({
    parse: (value) => {
      const date = DATE_ONLY.test(value)
        ? edge(fromISODate(value))
        : new Date(value)
      return Number.isNaN(date.getTime()) ? null : date
    },
    serialize: (date) => date.toISOString(),
    eq: (a, b) => a.getTime() === b.getTime(),
  })

export const parseAsDayStart = parseAsDay(startOfDay)
export const parseAsDayEnd = parseAsDay(endOfDay)
