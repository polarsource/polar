import { formatSubCentCurrency } from '@/utils/formatters'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const getIndicatorColor = (cost: number) => {
  const colors = {
    positive:
      'bg-emerald-50 dark:bg-emerald-950 text-emerald-500 dark:text-emerald-500 dark:group-hover:bg-emerald-950 group-hover:bg-emerald-100',
    negative:
      'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-500 dark:group-hover:bg-red-950 group-hover:bg-red-100',
    neutral:
      'bg-gray-100 dark:bg-polar-700 text-gray-500 dark:text-gray-500 dark:group-hover:bg-white/5 group-hover:bg-black/5',
  }

  if (cost > 0) {
    return colors.negative
  }

  if (cost < 0) {
    return colors.positive
  }

  return colors.neutral
}

export const EventCostIndicator = ({ cost }: { cost: number }) => {
  const color = getIndicatorColor(cost)

  const icon = useMemo(() => {
    if (cost < 0) {
      return <KeyboardArrowUp fontSize="inherit" />
    }

    if (cost > 0) {
      return <KeyboardArrowDown fontSize="inherit" />
    }

    return '—'
  }, [cost])

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
        <EventCostIndicator cost={0} />
      </div>
    )
  }

  const { cost } = props as EventCostWithAmountBadgeProps
  const parsedNumber = Number(cost)

  return (
    <div className="flex flex-row items-center gap-x-4 font-mono">
      {formatSubCentCurrency(parsedNumber)}
      <EventCostIndicator cost={parsedNumber} />
    </div>
  )
}
