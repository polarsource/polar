const stripTrailingZeros = (value: string): string => {
  return value.replace(/\.0+([^0-9]*)$/g, '$1')
}

export const formatScalar = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (value: number): string => stripTrailingZeros(formatter.format(value))
})()

export const formatHumanFriendlyScalar = (() => {
  const compactFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumSignificantDigits: 5,
    maximumFractionDigits: 3,
    roundingPriority: 'lessPrecision',
  })
  const integerFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  })
  const standardFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (value: number): string => {
    if (Math.abs(value) >= 1_000_000) {
      return compactFormatter.format(value)
    }

    if (Math.abs(value) >= 10_000) {
      return integerFormatter.format(Math.trunc(value))
    }

    return stripTrailingZeros(standardFormatter.format(value))
  }
})()

export const formatPercentage = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (value: number): string => stripTrailingZeros(formatter.format(value))
})()

export const formatCountry = (() => {
  const regionName = new Intl.DisplayNames(['en'], { type: 'region' })

  return (country: string): string => regionName.of(country) ?? country
})()
