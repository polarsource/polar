import { useMemo } from 'react'

interface FormattedDateTimeProps {
  datetime: Date | string
  locale?: string
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
  resolution?: 'time' | 'day' | 'month'
}

const FormattedDateTime: React.FC<FormattedDateTimeProps> = ({
  datetime,
  locale = 'en-US',
  dateStyle = 'medium',
  timeStyle = 'short',
  resolution = 'day',
}) => {
  const parsedDate = useMemo(() => new Date(datetime), [datetime])
  const formatted = useMemo(() => {
    try {
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
  }, [parsedDate, locale, resolution, dateStyle, timeStyle])

  return (
    <time suppressHydrationWarning dateTime={parsedDate.toISOString()}>
      {formatted}
    </time>
  )
}

export default FormattedDateTime
