import { useMemo } from 'react'

interface FormattedDateTimeProps {
  datetime: Date | string
  locale?: string
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
  resolution?: 'time' | 'day' | 'month'
  showYear?: boolean
}

const FormattedDateTime: React.FC<FormattedDateTimeProps> = ({
  datetime,
  locale = 'en-US',
  dateStyle = 'medium',
  timeStyle = 'short',
  resolution = 'day',
  showYear = true,
}) => {
  const parsedDate = useMemo(() => new Date(datetime), [datetime])
  const isValidDate = useMemo(
    () => !Number.isNaN(parsedDate.getTime()),
    [parsedDate],
  )
  const formatted = useMemo(() => {
    try {
      if (!isValidDate) {
        return 'Invalid date'
      }

      if (!showYear) {
        if (resolution === 'time') {
          return parsedDate.toLocaleString(locale, {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        }
        return parsedDate.toLocaleDateString(locale, {
          month: 'long',
          day: 'numeric',
        })
      }

      if (resolution === 'time') {
        return parsedDate.toLocaleString(locale, { dateStyle, timeStyle })
      }

      if (resolution === 'month') {
        return parsedDate.toLocaleDateString(locale, {
          month: 'short',
          year: 'numeric',
        })
      }

      return parsedDate.toLocaleDateString(locale, {
        dateStyle,
      })
    } catch {
      return 'Invalid date or locale'
    }
  }, [
    parsedDate,
    isValidDate,
    locale,
    resolution,
    dateStyle,
    timeStyle,
    showYear,
  ])

  return (
    <time
      suppressHydrationWarning
      dateTime={isValidDate ? parsedDate.toISOString() : undefined}
    >
      {formatted}
    </time>
  )
}

export default FormattedDateTime
