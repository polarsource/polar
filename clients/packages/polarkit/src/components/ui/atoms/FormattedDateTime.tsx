import { useMemo } from 'react'

interface FormattedDateTimeProps {
  datetime: Date | string
  locale?: string
  displayTime?: boolean
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
}

const FormattedDateTime: React.FC<FormattedDateTimeProps> = ({
  datetime,
  locale,
  displayTime,
  dateStyle,
}) => {
  const formatted = useMemo(() => {
    try {
      const parsedDate = new Date(datetime)
      if (displayTime) {
        return parsedDate.toLocaleString(locale, { dateStyle })
      }
      return parsedDate.toLocaleDateString(locale, { dateStyle })
    } catch {
      return 'Invalid date or locale'
    }
  }, [datetime, locale, displayTime, dateStyle])

  return <>{formatted}</>
}

FormattedDateTime.defaultProps = {
  locale: 'en-US',
  displayTime: false,
  dateStyle: 'medium',
}

export default FormattedDateTime
