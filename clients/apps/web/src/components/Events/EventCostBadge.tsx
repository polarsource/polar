import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const getIndicatorColor = (cost: number) => {
  const colors = {
    positive:
      'bg-emerald-50 dark:bg-emerald-950 text-emerald-500 dark:text-emerald-500',
    negative: 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-500',
    neutral: 'bg-gray-100 dark:bg-polar-700 text-gray-500 dark:text-gray-500',
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
  cost: number | string
  currency: string
}) => {
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 17,
    notation: 'standard',
  })

  return (
    <div className="flex flex-row items-center gap-x-4 font-mono">
      {currencyNumberFormat.format(Number(cost))}
      <EventCostIndicator cost={Number(cost)} />
    </div>
  )
}
