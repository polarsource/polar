'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import {
  useEventHierarchyStats,
  useEventPropertyGroupStats,
} from '@/hooks/queries/events'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { endOfDay, subDays } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { getDefaultEndDate, getDefaultStartDate } from './utils'

interface ClientPageProps {
  organization: schemas['Organization']
}

export default function ClientPage({ organization }: ClientPageProps) {
  const [startDateISOString, setStartDateISOString] = useQueryState(
    'startDate',
    parseAsString.withDefault(getDefaultStartDate()),
  )
  const [endDateISOString, setEndDateISOString] = useQueryState(
    'endDate',
    parseAsString.withDefault(getDefaultEndDate()),
  )

  const dateRange = useMemo(
    () => ({
      from: fromISODate(startDateISOString),
      to: endOfDay(fromISODate(endDateISOString)),
    }),
    [startDateISOString, endDateISOString],
  )
  const [customerIds] = useQueryState(
    'customerIds',
    parseAsArrayOf(parseAsString),
  )

  const [prevStart, prevEnd] = useMemo(() => {
    const start = dateRange.from
    const end = dateRange.to
    const durationMs = end.getTime() - start.getTime()
    const prevEnd = subDays(start, 1)
    const prevStart = new Date(prevEnd.getTime() - durationMs)
    return [prevStart, prevEnd]
  }, [dateRange])

  const { data: currentStats } = useEventHierarchyStats(organization.id, {
    start_date: startDateISOString,
    end_date: endDateISOString,
    interval: 'month',
    aggregate_fields: ['_cost.amount'],
    customer_id: customerIds,
  })

  const { data: previousStats } = useEventHierarchyStats(organization.id, {
    start_date: prevStart.toISOString().split('T')[0],
    end_date: prevEnd.toISOString().split('T')[0],
    interval: 'month',
    aggregate_fields: ['_cost.amount'],
    customer_id: customerIds,
  })

  const currentTotals = useMemo(
    () => currentStats?.totals ?? [],
    [currentStats],
  )

  const previousTotalsMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of previousStats?.totals ?? []) {
      map.set(s.name, parseFloat(String(s.totals?.['_cost_amount'] ?? '0')))
    }
    return map
  }, [previousStats])

  // Summary metrics
  const summary = useMemo(() => {
    let totalCost = 0
    let totalOccurrences = 0
    let totalCustomers = 0
    for (const s of currentTotals) {
      totalCost += parseFloat(String(s.totals?.['_cost_amount'] ?? '0'))
      totalOccurrences += s.occurrences
      totalCustomers = Math.max(totalCustomers, s.customers)
    }
    const prevTotal = Array.from(previousTotalsMap.values()).reduce(
      (a, b) => a + b,
      0,
    )
    const delta = totalCost - prevTotal
    const pct = prevTotal > 0 ? (delta / prevTotal) * 100 : null

    const costPerCustomer = totalCustomers > 0 ? totalCost / totalCustomers : 0

    let prevCustomers = 0
    for (const s of previousStats?.totals ?? []) {
      prevCustomers = Math.max(prevCustomers, s.customers)
    }
    const prevCostPerCustomer =
      prevCustomers > 0 ? prevTotal / prevCustomers : 0
    const cpcDelta = costPerCustomer - prevCostPerCustomer
    const cpcPct =
      prevCostPerCustomer > 0 ? (cpcDelta / prevCostPerCustomer) * 100 : null

    return {
      totalCost,
      totalOccurrences,
      totalCustomers,
      delta,
      pct,
      costPerCustomer,
      cpcDelta,
      cpcPct,
    }
  }, [currentTotals, previousTotalsMap, previousStats])

  // "Where money is going" — ranked by total cost with share bars
  const byTotal = useMemo(() => {
    const rows = [...currentTotals]
      .map((s) => ({
        ...s,
        total: parseFloat(String(s.totals?.['_cost_amount'] ?? '0')),
        avg: parseFloat(String(s.averages?.['_cost_amount'] ?? '0')),
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total)
    const max = rows[0]?.total ?? 1
    return rows.map((r) => ({ ...r, share: r.total / max }))
  }, [currentTotals])

  // "What changed" — biggest movers vs previous period
  const byChange = useMemo(
    () =>
      [...currentTotals]
        .map((s) => {
          const current = parseFloat(String(s.totals?.['_cost_amount'] ?? '0'))
          const previous = previousTotalsMap.get(s.name) ?? 0
          const delta = current - previous
          const pct = previous > 0 ? (delta / previous) * 100 : null
          return { ...s, current, previous, delta, pct }
        })
        .filter((s) => Math.abs(s.delta) > 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 6),
    [currentTotals, previousTotalsMap],
  )

  // "What needs attention" — high variance spans (p99 >> average)
  const byVariance = useMemo(
    () =>
      [...currentTotals]
        .map((s) => {
          const avg = parseFloat(String(s.averages?.['_cost_amount'] ?? '0'))
          const p99 = parseFloat(String(s.p99?.['_cost_amount'] ?? '0'))
          const ratio = avg > 0 ? p99 / avg : 0
          return { ...s, avg, p99, ratio }
        })
        .filter((s) => s.ratio >= 3 && s.p99 > 0)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 6),
    [currentTotals],
  )

  const llmDateParams = useMemo(
    () => ({
      start_date: startDateISOString,
      end_date: endDateISOString,
      aggregate_fields: ['_cost.amount'],
    }),
    [startDateISOString, endDateISOString],
  )

  const llmPrevDateParams = useMemo(
    () => ({
      start_date: prevStart.toISOString().split('T')[0],
      end_date: prevEnd.toISOString().split('T')[0],
      aggregate_fields: ['_cost.amount'],
    }),
    [prevStart, prevEnd],
  )

  const { data: modelStats } = useEventPropertyGroupStats(
    organization.id,
    '_llm.model',
    llmDateParams,
  )

  const { data: prevModelStats } = useEventPropertyGroupStats(
    organization.id,
    '_llm.model',
    llmPrevDateParams,
  )

  const { data: vendorStats } = useEventPropertyGroupStats(
    organization.id,
    '_llm.vendor',
    llmDateParams,
  )

  const { data: prevVendorStats } = useEventPropertyGroupStats(
    organization.id,
    '_llm.vendor',
    llmPrevDateParams,
  )

  const getCost = (r: { totals?: Record<string, string> }) =>
    parseFloat(r.totals?.['_cost_amount'] ?? '0')

  const modelRows = useMemo(() => {
    const prevMap = new Map(
      (prevModelStats?.items ?? []).map((r) => [r.value, getCost(r)]),
    )
    const rows = (modelStats?.items ?? []).filter((r) => getCost(r) > 0)
    const max = getCost(rows[0] ?? {}) || 1
    return rows.map((r) => {
      const total = getCost(r)
      const prev = prevMap.get(r.value) ?? 0
      const delta = total - prev
      const pct = prev > 0 ? (delta / prev) * 100 : null
      return { ...r, total, share: total / max, prev, delta, pct }
    })
  }, [modelStats, prevModelStats])

  const vendorRows = useMemo(() => {
    const prevMap = new Map(
      (prevVendorStats?.items ?? []).map((r) => [r.value, getCost(r)]),
    )
    const rows = (vendorStats?.items ?? []).filter((r) => getCost(r) > 0)
    const max = getCost(rows[0] ?? {}) || 1
    return rows.map((r) => {
      const total = getCost(r)
      const prev = prevMap.get(r.value) ?? 0
      const delta = total - prev
      const pct = prev > 0 ? (delta / prev) * 100 : null
      return { ...r, total, share: total / max, prev, delta, pct }
    })
  }, [vendorStats, prevVendorStats])

  const router = useRouter()

  const spanHref = (s: { event_type_id: string }) =>
    `/dashboard/${organization.slug}/analytics/costs/${s.event_type_id}`

  const fmt = formatCurrency('accounting')
  const fmtSub = formatCurrency('subcent')
  const fmtPct = (n: number) =>
    Math.abs(n).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '%'

  return (
    <DashboardBody
      title="Cost Insights"
      header={
        <DateRangePicker
          date={dateRange}
          onDateChange={(range) => {
            setStartDateISOString(toISODate(range.from))
            setEndDateISOString(toISODate(range.to))
          }}
        />
      }
    >
      <Tabs defaultValue="overview">
        <TabsList className="mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="llm">LLM</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="flex flex-col gap-y-10">
            <div className="grid grid-cols-3 gap-4">
              <StatisticCard title="Total Spend" size="lg">
                <span className="tabular-nums">
                  {fmt(summary.totalCost, 'usd')}
                </span>
                {summary.pct !== null && (
                  <TrendBadge
                    delta={summary.delta}
                    pct={summary.pct}
                    currentStart={dateRange.from}
                    currentEnd={dateRange.to}
                    prevStart={prevStart}
                    prevEnd={prevEnd}
                  />
                )}
              </StatisticCard>
              <StatisticCard title="Cost per Customer" size="lg">
                <span className="tabular-nums">
                  {fmt(summary.costPerCustomer, 'usd')}
                </span>
                {summary.cpcPct !== null && (
                  <TrendBadge
                    delta={summary.cpcDelta}
                    pct={summary.cpcPct}
                    currentStart={dateRange.from}
                    currentEnd={dateRange.to}
                    prevStart={prevStart}
                    prevEnd={prevEnd}
                  />
                )}
              </StatisticCard>
              <StatisticCard title="Customers" size="lg">
                {summary.totalCustomers.toLocaleString()}
              </StatisticCard>
            </div>

            {/* Where money is going */}
            <section>
              <SectionHeader
                title="Breakdown"
                description="Ranked by total spend in this period."
              />
              {byTotal.length === 0 ? (
                <EmptySection message="No cost data for this period." />
              ) : (
                <List size="small">
                  {byTotal.map((s, i) => {
                    const sharePct = Math.round(s.share * 100)
                    const prevTotal = previousTotalsMap.get(s.name) ?? 0
                    const delta = s.total - prevTotal
                    const deltaPct =
                      prevTotal > 0 ? (delta / prevTotal) * 100 : null
                    return (
                      <ListItem
                        key={s.event_type_id}
                        className="flex-col items-stretch gap-3 py-4"
                        onSelect={() => router.push(spanHref(s))}
                      >
                        {/* Top row */}
                        <div className="flex items-center gap-4">
                          <span className="dark:text-polar-600 w-5 shrink-0 text-right text-xs text-gray-300 tabular-nums">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium dark:text-white">
                            {s.label}
                          </span>
                          <div className="flex shrink-0 items-center gap-5">
                            {deltaPct !== null && (
                              <TrendBadge
                                delta={delta}
                                pct={deltaPct}
                                currentStart={dateRange.from}
                                currentEnd={dateRange.to}
                                prevStart={prevStart}
                                prevEnd={prevEnd}
                              />
                            )}
                            <span className="dark:text-polar-400 text-xs text-gray-400 tabular-nums">
                              {s.occurrences.toLocaleString()} events
                            </span>
                            <span className="dark:text-polar-400 text-xs text-gray-400 tabular-nums">
                              avg {fmtSub(s.avg, 'usd')}
                            </span>
                            <span className="w-24 text-right font-mono text-sm font-semibold tabular-nums dark:text-white">
                              {fmt(s.total, 'usd')}
                            </span>
                          </div>
                        </div>

                        {/* Share bar */}
                        <div className="flex items-center gap-3 pl-9">
                          <div className="dark:bg-polar-700 relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                          <span className="dark:text-polar-500 w-9 shrink-0 text-right text-xs text-gray-400 tabular-nums">
                            {sharePct}%
                          </span>
                        </div>
                      </ListItem>
                    )
                  })}
                </List>
              )}
            </section>

            {/* What changed */}
            <section>
              <SectionHeader
                title="Changes"
                description="Biggest cost movers compared to the previous period."
              />
              {byChange.length === 0 ? (
                <EmptySection message="No changes compared to the previous period." />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {byChange.map((s) => {
                    const isUp = s.delta > 0
                    const isDown = s.delta < 0
                    return (
                      <Link
                        key={s.event_type_id}
                        href={spanHref(s)}
                        className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm leading-snug font-medium dark:text-white">
                            {s.label}
                          </span>
                          <span
                            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              isUp
                                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                : isDown
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                  : 'dark:bg-polar-700 bg-gray-100 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {isUp ? (
                              <ArrowUpRight className="size-3" />
                            ) : isDown ? (
                              <ArrowDownRight className="size-3" />
                            ) : (
                              <Minus className="size-3" />
                            )}
                            {s.pct !== null
                              ? fmtPct(s.pct)
                              : fmt(Math.abs(s.delta), 'usd')}
                          </span>
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="dark:text-polar-500 flex flex-col gap-0.5 text-xs text-gray-400">
                            <span>prev {fmt(s.previous, 'usd')}</span>
                            <span>now {fmt(s.current, 'usd')}</span>
                          </div>
                          <span className="font-mono text-lg font-medium tabular-nums dark:text-white">
                            {fmt(s.current, 'usd')}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            {/* What needs attention */}
            <section>
              <SectionHeader
                title="Anomalies"
                description="Spans where p99 cost is 3× or more above the average — a sign of runaway or unpredictable events."
              />
              {byVariance.length === 0 ? (
                <EmptySection message="No unusual cost patterns detected." />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {byVariance.map((s) => (
                    <Link
                      key={s.event_type_id}
                      href={spanHref(s)}
                      className="dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm leading-snug font-medium dark:text-white">
                          {s.label}
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                          {s.ratio.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                          × spike
                        </span>
                      </div>
                      <div className="dark:bg-polar-700 flex overflow-hidden rounded-lg bg-gray-100">
                        <div className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2">
                          <span className="dark:text-polar-400 text-xs text-gray-500">
                            avg
                          </span>
                          <span className="font-mono text-sm tabular-nums dark:text-white">
                            {fmtSub(s.avg, 'usd')}
                          </span>
                        </div>
                        <div className="dark:bg-polar-600 w-px bg-gray-200" />
                        <div className="flex flex-1 flex-col items-center gap-0.5 px-3 py-2">
                          <span className="text-xs text-amber-500">p99</span>
                          <span className="font-mono text-sm text-amber-600 tabular-nums dark:text-amber-400">
                            {fmtSub(s.p99, 'usd')}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="llm">
          <div className="flex flex-col gap-y-10">
            <section>
              <SectionHeader
                title="By Model"
                description="LLM models ranked by total cost in this period."
              />
              {modelRows.length === 0 ? (
                <EmptySection message="No LLM model cost data for this period." />
              ) : (
                <List size="small">
                  {modelRows.map((r, i) => {
                    const sharePct = Math.round(r.share * 100)
                    return (
                      <ListItem
                        key={r.value}
                        className="flex-col items-stretch gap-3 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <span className="dark:text-polar-600 w-5 shrink-0 text-right text-xs text-gray-300 tabular-nums">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium dark:text-white">
                            {r.value}
                          </span>
                          <div className="flex shrink-0 items-center gap-5">
                            {r.pct !== null && (
                              <TrendBadge
                                delta={r.delta}
                                pct={r.pct}
                                currentStart={dateRange.from}
                                currentEnd={dateRange.to}
                                prevStart={prevStart}
                                prevEnd={prevEnd}
                              />
                            )}
                            <span className="dark:text-polar-400 text-xs text-gray-400 tabular-nums">
                              {r.occurrences.toLocaleString()} events
                            </span>
                            <span className="dark:text-polar-400 text-xs text-gray-400 tabular-nums">
                              {r.customers.toLocaleString()} customers
                            </span>
                            <span className="w-24 text-right font-mono text-sm font-semibold tabular-nums dark:text-white">
                              {fmt(r.total, 'usd')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pl-9">
                          <div className="dark:bg-polar-700 relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                          <span className="dark:text-polar-500 w-9 shrink-0 text-right text-xs text-gray-400 tabular-nums">
                            {sharePct}%
                          </span>
                        </div>
                      </ListItem>
                    )
                  })}
                </List>
              )}
            </section>

            <section>
              <SectionHeader
                title="By Vendor"
                description="LLM vendors ranked by total cost in this period."
              />
              {vendorRows.length === 0 ? (
                <EmptySection message="No LLM vendor cost data for this period." />
              ) : (
                <List size="small">
                  {vendorRows.map((r, i) => {
                    const sharePct = Math.round(r.share * 100)
                    return (
                      <ListItem
                        key={r.value}
                        className="flex-col items-stretch gap-3 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <span className="dark:text-polar-600 w-5 shrink-0 text-right text-xs text-gray-300 tabular-nums">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium dark:text-white">
                            {r.value}
                          </span>
                          <div className="flex shrink-0 items-center gap-5">
                            {r.pct !== null && (
                              <TrendBadge
                                delta={r.delta}
                                pct={r.pct}
                                currentStart={dateRange.from}
                                currentEnd={dateRange.to}
                                prevStart={prevStart}
                                prevEnd={prevEnd}
                              />
                            )}
                            <span className="dark:text-polar-400 text-xs text-gray-400 tabular-nums">
                              {r.occurrences.toLocaleString()} events
                            </span>
                            <span className="dark:text-polar-400 text-xs text-gray-400 tabular-nums">
                              {r.customers.toLocaleString()} customers
                            </span>
                            <span className="w-24 text-right font-mono text-sm font-semibold tabular-nums dark:text-white">
                              {fmt(r.total, 'usd')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pl-9">
                          <div className="dark:bg-polar-700 relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                          <span className="dark:text-polar-500 w-9 shrink-0 text-right text-xs text-gray-400 tabular-nums">
                            {sharePct}%
                          </span>
                        </div>
                      </ListItem>
                    )
                  })}
                </List>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardBody>
  )
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

function TrendBadge({
  delta,
  pct,
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
}: {
  delta: number
  pct: number
  currentStart: Date
  currentEnd: Date
  prevStart: Date
  prevEnd: Date
}) {
  const isUp = delta > 0
  const isDown = delta < 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`mt-1 flex w-fit cursor-default items-center gap-1 text-xs font-normal ${
            isUp
              ? 'text-red-500'
              : isDown
                ? 'text-emerald-500'
                : 'dark:text-polar-500 text-gray-400'
          }`}
        >
          {isUp ? (
            <ArrowUpRight className="size-3" />
          ) : isDown ? (
            <ArrowDownRight className="size-3" />
          ) : (
            <Minus className="size-3" />
          )}
          {Math.abs(pct).toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          %
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1">
        <span>
          {fmtDate(currentStart)} – {fmtDate(currentEnd)}
        </span>
        <span className="dark:text-polar-400 text-gray-400">
          vs {fmtDate(prevStart)} – {fmtDate(prevEnd)}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-medium dark:text-white">{title}</h2>
      <p className="dark:text-polar-500 mt-0.5 text-sm text-gray-400">
        {description}
      </p>
    </div>
  )
}

function EmptySection({ message }: { message: string }) {
  return (
    <p className="dark:text-polar-500 py-4 text-sm text-gray-400">{message}</p>
  )
}
