import React, { useMemo } from 'react'

interface FormattedUnitsProps {
  value: string | number
}

const FormattedUnits: React.FC<FormattedUnitsProps> = ({ value }) => {
  const formatter = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      notation: 'standard',
      maximumFractionDigits: 14,
    })
  }, [])

  const formattedValue = useMemo(() => {
    // Convert string to number if needed
    const numberValue = typeof value === 'string' ? parseFloat(value) : value

    // Only format if it's a valid number
    if (!isNaN(numberValue)) {
      return formatter.format(numberValue)
    }

    return value
  }, [value, formatter])

  return <>{formattedValue}</>
}

export default FormattedUnits
