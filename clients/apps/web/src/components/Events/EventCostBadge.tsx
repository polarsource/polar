import { formatSubCentCurrency } from '@/utils/formatters'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const getIndicatorColor = (type: 'cost' | 'revenue' | 'neutral') => {
  const colors = {
    positive:
      'bg-emerald-50 dark:bg-emerald-950 text-emerald-500 dark:text-emerald-500 dark:group-hover:bg-emerald-950 group-hover:bg-emerald-100',
    negative:
      'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-500 dark:group-hover:bg-red-950 group-hover:bg-red-100',
    neutral:
      'bg-gray-100 dark:bg-polar-700 text-gray-500 dark:text-polar-500 dark:group-hover:bg-white/5 group-hover:bg-black/5',
  }

  if (type === 'cost') {
    return colors.negative
  }

  if (type === 'revenue') {
    return colors.positive
  }

  return colors.neutral
}

export const EventCostIndicator = ({
  type,
}: {
  type: 'cost' | 'revenue' | 'neutral'
}) => {
  const color = getIndicatorColor(type)

  const icon = useMemo(() => {
    if (type === 'revenue') {
      return <KeyboardArrowUp fontSize="inherit" />
    }

    if (type === 'cost') {
      return <KeyboardArrowDown fontSize="inherit" />
    }

    return '—'
  }, [type])

  return (
    <div
      className={twMerge(
        'flex h-6 w-6 items-center justify-center rounded-sm transition-colors duration-150',
        color,
      )}
    >
      {icon}
    </div>
  )
}

export interface EventCostWithAmountBadgeProps {
  cost: number | string
  currency: string
  type: 'cost' | 'revenue'
}

export interface EventCostWithoutAmountBadgeProps {
  nonCostEvent: boolean
}

export type EventCostBadgeProps =
  | EventCostWithAmountBadgeProps
  | EventCostWithoutAmountBadgeProps

export const EventCostBadge = (props: EventCostBadgeProps) => {
  if ('nonCostEvent' in props && props.nonCostEvent) {
    return (
      <div className="flex flex-row items-center gap-x-4 font-mono">
        <EventCostIndicator type="neutral" />
      </div>
    )
  }

  const { cost, type, currency } = props as EventCostWithAmountBadgeProps
  const parsedNumber = Number(cost)

  return (
    <div className="flex flex-row items-center gap-x-4 font-mono">
      {formatSubCentCurrency(parsedNumber, currency)}
      <EventCostIndicator type={cost === 0 ? 'neutral' : type} />
    </div>
  )
}
