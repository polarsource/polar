const stripTrailingZeros = (value: string): string => {
  return value.replace(/\.0+([^0-9]*)$/g, '$1')
}

export const formatInteger = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  })

  return (value: number): string => formatter.format(value)
})()

export const formatHumanFriendlyInteger = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    notation: 'compact',
    compactDisplay: 'short',
  })

  return (value: number): string => stripTrailingZeros(formatter.format(value))
})()

export const formatDecimal = (() => {
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (value: number): string =>
    stripTrailingZeros(formatter.format(value / 100))
})()

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
