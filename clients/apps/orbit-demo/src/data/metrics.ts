export type DailyPoint = {
  date: string
  revenueCents: number
  ordersCount: number
  mrrCents: number
  activeSubs: number
  newSubs: number
  canceledSubs: number
  churnPct: number
  netNewCustomers: number
}

export type ProductBreakdown = {
  id: string
  name: string
  revenueCents: number
  shareOfRevenuePct: number
  activeSubs: number
}

export type CountryBreakdown = {
  code: string
  name: string
  revenueCents: number
  customers: number
}

export type MetricsSummary = {
  range: { start: string; end: string }
  totals: {
    revenueCents: number
    revenueDeltaPct: number
    ordersCount: number
    ordersDeltaPct: number
    mrrCents: number
    mrrDeltaPct: number
    activeSubs: number
    activeSubsDeltaPct: number
    arpuCents: number
    arpuDeltaPct: number
    churnPct: number
    churnDeltaPct: number
  }
  daily: DailyPoint[]
  products: ProductBreakdown[]
  countries: CountryBreakdown[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const seed = (n: number) => {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const buildDaily = (): DailyPoint[] => {
  const end = new Date('2026-05-19T00:00:00Z')
  const days = 30
  const points: DailyPoint[] = []

  let mrr = 78_400_00
  let active = 612

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end.getTime() - i * DAY_MS).toISOString().slice(0, 10)
    const dow = new Date(date).getUTCDay()
    const weekend = dow === 0 || dow === 6

    const noise = seed(i) - 0.5
    const trend = (days - i) / days

    const revenueCents = Math.round(
      (2_400_00 + trend * 1_800_00 + (weekend ? -700_00 : 350_00) + noise * 900_00) *
        (1 + seed(i + 7) * 0.18),
    )
    const ordersCount = Math.max(
      8,
      Math.round(28 + trend * 22 + (weekend ? -8 : 4) + noise * 12),
    )
    const newSubs = Math.max(0, Math.round(6 + trend * 5 + noise * 4))
    const canceledSubs = Math.max(0, Math.round(2 + seed(i + 3) * 3))

    active = active + newSubs - canceledSubs
    mrr = Math.round(mrr + revenueCents * 0.06 - canceledSubs * 1800)

    const churnPct = Number(((canceledSubs / Math.max(1, active)) * 100).toFixed(2))

    points.push({
      date,
      revenueCents: Math.max(0, revenueCents),
      ordersCount,
      mrrCents: mrr,
      activeSubs: active,
      newSubs,
      canceledSubs,
      churnPct,
      netNewCustomers: newSubs - canceledSubs,
    })
  }

  return points
}

const DAILY = buildDaily()

const sumRevenue = DAILY.reduce((sum, p) => sum + p.revenueCents, 0)
const sumOrders = DAILY.reduce((sum, p) => sum + p.ordersCount, 0)
const lastMrr = DAILY[DAILY.length - 1].mrrCents
const lastActive = DAILY[DAILY.length - 1].activeSubs
const avgChurn = Number(
  (DAILY.reduce((s, p) => s + p.churnPct, 0) / DAILY.length).toFixed(2),
)
const arpu = Math.round(lastMrr / Math.max(1, lastActive))

export const METRICS: MetricsSummary = {
  range: {
    start: DAILY[0].date,
    end: DAILY[DAILY.length - 1].date,
  },
  totals: {
    revenueCents: sumRevenue,
    revenueDeltaPct: 24.3,
    ordersCount: sumOrders,
    ordersDeltaPct: 11.8,
    mrrCents: lastMrr,
    mrrDeltaPct: 8.6,
    activeSubs: lastActive,
    activeSubsDeltaPct: 4.2,
    arpuCents: arpu,
    arpuDeltaPct: 2.1,
    churnPct: avgChurn,
    churnDeltaPct: -0.8,
  },
  daily: DAILY,
  products: [
    {
      id: 'p_enterprise',
      name: 'Bitspace Enterprise',
      revenueCents: 38_420_00,
      shareOfRevenuePct: 42,
      activeSubs: 78,
    },
    {
      id: 'p_pro',
      name: 'Bitspace Pro',
      revenueCents: 22_140_00,
      shareOfRevenuePct: 24,
      activeSubs: 312,
    },
    {
      id: 'p_startup',
      name: 'Bitspace Startup',
      revenueCents: 14_980_00,
      shareOfRevenuePct: 16,
      activeSubs: 184,
    },
    {
      id: 'p_custom',
      name: 'Bitspace Custom',
      revenueCents: 10_640_00,
      shareOfRevenuePct: 12,
      activeSubs: 26,
    },
    {
      id: 'p_usage',
      name: 'Bitspace Usage',
      revenueCents: 5_980_00,
      shareOfRevenuePct: 6,
      activeSubs: 64,
    },
  ],
  countries: [
    { code: 'US', name: 'United States', revenueCents: 41_220_00, customers: 248 },
    { code: 'SE', name: 'Sweden', revenueCents: 18_640_00, customers: 96 },
    { code: 'DE', name: 'Germany', revenueCents: 12_180_00, customers: 84 },
    { code: 'GB', name: 'United Kingdom', revenueCents: 9_820_00, customers: 71 },
    { code: 'NO', name: 'Norway', revenueCents: 6_240_00, customers: 38 },
    { code: 'CA', name: 'Canada', revenueCents: 4_180_00, customers: 29 },
  ],
}

export const formatCompactMoney = (cents: number): string => {
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(dollars) >= 1_000) {
    return `$${(dollars / 1_000).toFixed(1)}k`
  }
  return `$${dollars.toFixed(0)}`
}

export const formatCompactNumber = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
