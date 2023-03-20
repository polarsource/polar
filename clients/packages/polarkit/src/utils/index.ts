export * from './dom'

export const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  const baseURL = process?.env?.NEXT_PUBLIC_API_URL
  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

export const getCentsInDollarString = (cents: number): string => {
  const dollars = cents / 100
  return dollars.toString()
}
