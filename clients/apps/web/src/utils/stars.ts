export const formatStarsNumber = (stars: number): string => {
  if (stars < 1000) {
    return stars.toString()
  }

  stars /= 1000
  return stars.toFixed(1) + 'k'
}
