'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatCompactMoney, formatCompactNumber } from '@/data/metrics'

type PayloadEntry = {
  name?: string
  dataKey?: string | number
  color?: string
  stroke?: string
  fill?: string
  value?: number | string
}

export type TooltipValueKind = 'currency' | 'number' | 'percent'

type ChartTooltipProps = {
  active?: boolean
  payload?: PayloadEntry[]
  label?: string | number
  dateLabel?: boolean
  kind?: TooltipValueKind | Record<string, TooltipValueKind>
  nameMap?: Record<string, string>
}

const formatValue = (value: number | string, kind: TooltipValueKind): string => {
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(n)) return String(value)
  switch (kind) {
    case 'currency':
      return formatCompactMoney(n)
    case 'percent':
      return `${n.toFixed(2)}%`
    case 'number':
    default:
      return formatCompactNumber(n)
  }
}

const formatDate = (value: string | number): string =>
  new Date(String(value)).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })

export const ChartTooltip = ({
  active,
  payload,
  label,
  dateLabel,
  kind = 'number',
  nameMap,
}: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null

  return (
    <Box
      backgroundColor="background-primary"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingHorizontal="m"
      paddingVertical="m"
      display="flex"
      flexDirection="column"
      rowGap="s"
      minWidth={180}
    >
      {label !== undefined && (
        <Text variant="caption" color="muted">
          {dateLabel ? formatDate(label) : String(label)}
        </Text>
      )}
      {payload.map((entry, idx) => {
        const dataKey = String(entry.dataKey ?? '')
        const valueKind =
          typeof kind === 'string' ? kind : (kind[dataKey] ?? 'number')
        const color = entry.color ?? entry.stroke ?? entry.fill ?? 'currentColor'
        const label = nameMap?.[dataKey] ?? entry.name ?? dataKey
        return (
          <Box
            key={`${dataKey}-${idx}`}
            display="flex"
            alignItems="center"
            justifyContent="between"
            columnGap="l"
          >
            <Box display="flex" alignItems="center" columnGap="s">
              <Box
                width={8}
                height={8}
                style={{ backgroundColor: color }}
              />
              <Text variant="caption" color="muted">
                {label}
              </Text>
            </Box>
            <Text variant="caption" color="default">
              {entry.value !== undefined
                ? formatValue(entry.value, valueKind)
                : ''}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
