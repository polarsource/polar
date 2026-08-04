import { DateRange } from '@/components/Metrics/DateRangePicker'
import { isSameDay } from 'date-fns/isSameDay'

export const formatCustomDateRange = (dateRange: DateRange): string => {
  const startDate = new Date(dateRange.from)
  const endDate = new Date(dateRange.to)
  const currentYear = new Date().getFullYear()
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  const startMonth = startDate.getMonth()
  const endMonth = endDate.getMonth()
  const separator = '–'
  const shouldHideYear = endYear === currentYear && startYear === endYear

  if (isSameDay(startDate, endDate)) {
    return endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(shouldHideYear ? {} : { year: 'numeric' }),
    })
  }

  if (startYear === endYear && startMonth === endMonth) {
    const startFormatted = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const endFormatted = `${endDate.toLocaleDateString('en-US', {
      day: 'numeric',
    })}${shouldHideYear ? '' : `, ${endYear}`}`
    return `${startFormatted} ${separator} ${endFormatted}`
  }

  if (startYear === endYear) {
    const startFormatted = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const endFormatted = endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(shouldHideYear ? {} : { year: 'numeric' }),
    })
    return `${startFormatted} ${separator} ${endFormatted}`
  }

  return `${startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} ${separator} ${endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}
