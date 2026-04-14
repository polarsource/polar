import { getMetricsRangeDates, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  subDays,
  subHours,
  subMonths,
} from 'date-fns'

const scalarFormatter = Intl.NumberFormat('en-US', {})
const percentageFormatter = Intl.NumberFormat('en-US', {
  style: 'percent',
})

export const getFormattedMetricValue = (
  metric: schemas['Metric'],
  value: number,
): string | undefined => {
  switch (metric.type) {
    case 'scalar':
      return scalarFormatter.format(value)
    case 'currency':
      return formatCurrency('statistics')(value, 'usd')
    case 'percentage':
      return percentageFormatter.format(value)
  }
}

export const dateRangeToInterval = (startDate: Date, endDate: Date) => {
  const diffInYears = differenceInYears(endDate, startDate)
  const diffInMonths = differenceInMonths(endDate, startDate)
  const diffInWeeks = differenceInWeeks(endDate, startDate)
  const diffInDays = differenceInDays(endDate, startDate)

  if (diffInYears >= 3) {
    return 'year'
  } else if (diffInMonths >= 4) {
    return 'month'
  } else if (diffInWeeks > 4) {
    return 'week'
  } else if (diffInDays > 1) {
    return 'day'
  } else {
    return 'hour'
  }
}

export const timeRange = (organization: schemas['Organization']) =>
  (() => {
    const [last24hStartDate, last24hEndDate] = getMetricsRangeDates('24h')
    const [last30dStartDate, last30dEndDate] = getMetricsRangeDates('30d')
    const [last3mStartDate, last3mEndDate] = getMetricsRangeDates('3m')
    const [allTimeStartDate, allTimeEndDate] = getMetricsRangeDates(
      'all_time',
      {
        createdAt: organization.created_at,
      },
    )

    return {
      '24h': {
        startDate: last24hStartDate,
        endDate: last24hEndDate,
        title: '24h',
        description: 'Last 24 hours',
      },
      '30d': {
        startDate: last30dStartDate,
        endDate: last30dEndDate,
        title: '30d',
        description: 'Last 30 days',
      },
      '3m': {
        startDate: last3mStartDate,
        endDate: last3mEndDate,
        title: '3m',
        description: 'Last 3 months',
      },
      all_time: {
        startDate: allTimeStartDate,
        endDate: allTimeEndDate,
        title: 'All Time',
        description: 'All time',
      },
    } as const
  })()

export const getPreviousParams = (
  startDate: Date,
): Omit<ReturnType<typeof timeRange>, 'all_time'> => {
  return {
    '24h': {
      startDate: subHours(startDate, 24),
      endDate: startDate,
      title: '24h',
      description: 'Last 24 hours',
    },
    '30d': {
      startDate: subDays(startDate, 30),
      endDate: startDate,
      title: '30d',
      description: 'Last 30 days',
    },
    '3m': {
      startDate: subMonths(startDate, 3),
      endDate: startDate,
      title: '3m',
      description: 'Last 3 months',
    },
  }
}
