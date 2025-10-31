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
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    notation: 'compact',
    compactDisplay: 'short',
  })

  return (value: number): string => stripTrailingZeros(formatter.format(value))
})()

export const formatPercentage = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (value: number): string => stripTrailingZeros(formatter.format(value))
})()

export const formatCurrency = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (value: number): string =>
    stripTrailingZeros(formatter.format(value / 100))
})()

// Turns $1,123 into $1.1K, (threshold $1k, 1 decimal place)
export const formatHumanFriendlyCurrency = (() => {
  const smallNumberFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const largeNumberFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    notation: 'compact',
    compactDisplay: 'short',
  })

  const threshold = 1_000

  return (value: number): string =>
    stripTrailingZeros(
      value > threshold * 1000
        ? largeNumberFormatter.format(value / 100)
        : smallNumberFormatter.format(value / 100),
    )
})()

// Turns $23,456.78 into $23.456K and $1,234,876.54 into $1.234M (threshold 10k, three decimal places)
export const formatAccountingFriendlyCurrency = (() => {
  const smallNumberFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const largeNumberFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    notation: 'compact',
    compactDisplay: 'short',
  })

  const threshold = 10_000

  return (value: number): string =>
    stripTrailingZeros(
      value > threshold * 1000
        ? largeNumberFormatter.format(value / 100)
        : smallNumberFormatter.format(value / 100),
    )
})()

export const formatSubCentCurrency = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 8,
  })

  return (value: number): string =>
    stripTrailingZeros(formatter.format(value / 100))
})()
