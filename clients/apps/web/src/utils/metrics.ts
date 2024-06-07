import format from 'date-fns/format'

export const toISODate = (date: Date) => format(date, 'yyyy-MM-dd')
