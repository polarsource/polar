import { useMemo } from 'react'

interface FormattedDateTimeProps {
  datetime: Date | string
  locale?: string
  displayTime?: boolean
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
}

const FormattedDateTime: React.FC<FormattedDateTimeProps> = ({
  datetime,
  locale = 'en-US',
  displayTime = false,
  dateStyle = 'medium',
  timeStyle = 'short',
}) => {
  const formatted = useMemo(() => {
    try {
      const parsedDate = new Date(datetime)
      if (displayTime) {
        console.log('DISPLAY TIME')
        return parsedDate.toLocaleString(locale, { dateStyle, timeStyle })
      }
      return parsedDate.toLocaleDateString(locale, { dateStyle })
    } catch {
      return 'Invalid date or locale'
    }
  }, [datetime, locale, displayTime, dateStyle, timeStyle])

  return <>{formatted}</>
}

export default FormattedDateTime
