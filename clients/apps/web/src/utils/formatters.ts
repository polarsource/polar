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
  const currencyFormatterCache: { [key: string]: Intl.NumberFormat } = {}
  return (value: number, currency: string): string => {
    if (!currencyFormatterCache[currency]) {
      currencyFormatterCache[currency] = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
    return stripTrailingZeros(
      currencyFormatterCache[currency].format(value / 100),
    )
  }
})()

// Turns $1,123 into $1.1K, (threshold $1k, 1 decimal place)
export const formatHumanFriendlyCurrency = (() => {
  const smallNumberFormatterCache: { [key: string]: Intl.NumberFormat } = {}
  const largeNumberFormatterCache: { [key: string]: Intl.NumberFormat } = {}

  const threshold = 1_000

  return (value: number, currency: string): string => {
    if (!smallNumberFormatterCache[currency]) {
      smallNumberFormatterCache[currency] = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
    if (!largeNumberFormatterCache[currency]) {
      largeNumberFormatterCache[currency] = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        notation: 'compact',
        compactDisplay: 'short',
      })
    }
    return stripTrailingZeros(
      value > threshold * 1000
        ? largeNumberFormatterCache[currency].format(value / 100)
        : smallNumberFormatterCache[currency].format(value / 100),
    )
  }
})()

// Turns $23,456.78 into $23.456K and $1,234,876.54 into $1.234M (threshold 10k, three decimal places)
export const formatAccountingFriendlyCurrency = (() => {
  const smallNumberFormatterCache: { [key: string]: Intl.NumberFormat } = {}
  const largeNumberFormatterCache: { [key: string]: Intl.NumberFormat } = {}

  const threshold = 10_000

  return (value: number, currency: string): string => {
    if (!smallNumberFormatterCache[currency]) {
      smallNumberFormatterCache[currency] = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
    if (!largeNumberFormatterCache[currency]) {
      largeNumberFormatterCache[currency] = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
        notation: 'compact',
        compactDisplay: 'short',
      })
    }
    return stripTrailingZeros(
      value > threshold * 1000
        ? largeNumberFormatterCache[currency].format(value / 100)
        : smallNumberFormatterCache[currency].format(value / 100),
    )
  }
})()

export const formatSubCentCurrency = (() => {
  const currencyFormatterCache: { [key: string]: Intl.NumberFormat } = {}
  return (value: number, currency: string): string => {
    if (!currencyFormatterCache[currency]) {
      currencyFormatterCache[currency] = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      })
    }
    return stripTrailingZeros(
      currencyFormatterCache[currency].format(value / 100),
    )
  }
})()
