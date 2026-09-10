const DAYS = 30

export const cadenceFor = (spend: number, random: () => number): number[] => {
  if (spend === 0) return Array.from({ length: DAYS }, () => 0)
  const weights = Array.from({ length: DAYS }, () =>
    random() > 0.35 ? 0.4 + random() : 0,
  )
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  return weights.map((weight) => Math.round((spend * weight) / total))
}

const METER_WEIGHTS: Record<string, number> = {
  'Output tokens': 0.55,
  'Input tokens': 0.3,
  'Tool calls': 0.15,
}

const spread = (total: number, random: () => number): number[] => {
  const weights = Array.from({ length: DAYS }, () =>
    random() > 0.3 ? 0.3 + random() : 0.05,
  )
  const sum = weights.reduce((acc, weight) => acc + weight, 0)
  return weights.map((weight) => Math.round((total * weight) / sum))
}

export const usageSeriesFor = (usage: number, random: () => number) =>
  Object.fromEntries(
    Object.entries(METER_WEIGHTS).map(([name, weight]) => [
      name,
      spread(Math.round(usage * weight), random),
    ]),
  )

export const metersFor = (usage: number, random: () => number) => ({
  'Output tokens': Math.round(usage * (180 + random() * 60)),
  'Input tokens': Math.round(usage * (600 + random() * 200)),
  'Tool calls': Math.round(usage * (1.2 + random())),
})
