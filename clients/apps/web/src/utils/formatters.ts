const stripTrailingZeros = (value: string): string => {
  return value.replace(/\.0+([^0-9]*)$/g, '$1')
}

const scalarFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatScalar = (value: number): string =>
  stripTrailingZeros(scalarFormatter.format(value))

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

export const formatHumanFriendlyScalar = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    return compactFormatter.format(value)
  }

  if (Math.abs(value) >= 10_000) {
    return integerFormatter.format(Math.trunc(value))
  }

  return stripTrailingZeros(scalarFormatter.format(value))
}

const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatPercentage = (value: number): string =>
  stripTrailingZeros(percentageFormatter.format(value))

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export const formatCountry = (country: string): string =>
  regionNames.of(country) ?? country

export const formatMetadataValue = (
  value: string | number | boolean | null | undefined,
): string => {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}
