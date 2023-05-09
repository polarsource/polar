export * from './dom'
export * from './github'
export * from './useOutsideClick'

export const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  const baseURL = process?.env?.NEXT_PUBLIC_API_URL
  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

export const getCentsInDollarString = (
  cents: number,
  showCents = false,
): string => {
  const dollars = cents / 100
  if (cents % 100 === 0 && !showCents) {
    return dollars.toFixed(0)
  } else {
    return dollars.toFixed(2)
  }
}
