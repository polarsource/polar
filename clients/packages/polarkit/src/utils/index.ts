export * from './useOutsideClick'

export const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  const baseURL = process?.env?.NEXT_PUBLIC_API_URL
  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

export const formatStarsNumber = (stars: number): string => {
  if (stars < 1000) {
    return stars.toString()
  }

  stars /= 1000
  return stars.toFixed(1) + 'k'
}

export const dateOrString = (input: Date | string): Date => {
  if (typeof input === 'string') {
    return new Date(input)
  }
  return input
}
