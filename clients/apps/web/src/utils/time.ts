export const dateOrString = (input: Date | string): Date => {
  if (typeof input === 'string') {
    return new Date(input)
  }
  return input
}
