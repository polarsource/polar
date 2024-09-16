import tinycolor from 'tinycolor2'

export const computeComplementaryColor = (color: string) => {
  const accent = tinycolor(color)

  return [
    accent,
    accent.clone().lighten(8),
    accent.clone().lighten(16),
    accent.clone().lighten(24),
  ]
}
