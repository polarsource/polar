export * from './dom'
export * from './github'
export * from './useOutsideClick'

export const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  const baseURL = 'http://127.0.0.1:8000' // process?.env?.NEXT_PUBLIC_API_URL
  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

export const getCentsInDollarString = (cents: number): string => {
  const dollars = cents / 100
  if (cents % 100 === 0) {
    return dollars.toFixed(0)
  } else {
    return dollars.toFixed(2)
  }
}
