import tinycolor from 'tinycolor2'

export const computeComplementaryColor = (color: string) => {
  const accent = tinycolor(color)

  const { r, g, b } = accent.toRgb()

  const mono = [r, g, b].every((value, _, array) => value === array[0])

  return mono ? accent.monochromatic(4) : [accent, accent.clone().spin(40)]
}
