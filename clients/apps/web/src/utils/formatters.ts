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
