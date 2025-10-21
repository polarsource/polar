import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const getIndicatorColor = (cost: number) => {
  const colors = {
    positive: 'bg-emerald-500 dark:bg-emerald-950',
    negative: 'bg-red-100 dark:bg-red-950',
    neutral: 'bg-gray-200 dark:bg-polar-700',
  }

  if (cost > 0) {
    return colors.positive
  }

  if (cost < 0) {
    return colors.negative
  }

  return colors.neutral
}

export const EventCostIndicator = ({ cost }: { cost: number }) => {
  const color = getIndicatorColor(cost)

  const icon = useMemo(() => {
    if (cost > 0) {
      return <KeyboardArrowUp fontSize="inherit" />
    }
    if (cost < 0) {
      return <KeyboardArrowDown fontSize="inherit" />
    }
    return '—'
  }, [cost])

  return (
    <div
      className={twMerge(
        'flex h-6 w-6 items-center justify-center rounded-sm',
        color,
      )}
    >
      {icon}
    </div>
  )
}

export const EventCostBadge = ({
  cost,
  currency,
}: {
  cost: number
  currency: string
}) => {
  return (
    <div className="flex flex-row items-center gap-x-4 font-mono">
      <EventCostIndicator cost={cost} />
      {formatCurrencyAndAmount(cost, currency, 2)}
    </div>
  )
}
