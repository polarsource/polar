'use client'

import Circle from '@mui/icons-material/Circle'
import { formatCurrency } from '@polar-sh/currency'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { twMerge } from 'tailwind-merge'

const indicatorColor = {
  positive:
    'bg-emerald-50 dark:bg-emerald-950 text-emerald-500 dark:text-emerald-500 dark:group-hover:bg-emerald-950 group-hover:bg-emerald-100',
  warning:
    'bg-amber-50 dark:bg-amber-950 text-amber-500 dark:text-amber-500 dark:group-hover:bg-amber-950 group-hover:bg-amber-100',
  negative:
    'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-500 dark:group-hover:bg-red-950 group-hover:bg-red-100',
  neutral:
    'bg-gray-100 dark:bg-polar-700 text-gray-500 dark:text-polar-500 dark:group-hover:bg-white/5 group-hover:bg-black/5',
}

function getEventCostDeviation(
  eventCost: number,
  averageCost: number,
  p10Cost: number,
  p90Cost: number,
) {
  const deviation =
    averageCost > 0 ? ((eventCost - averageCost) / averageCost) * 100 : 0
  const isAboveAverage = eventCost > averageCost

  let barFillPercent: number
  let barColor: string

  if (isAboveAverage) {
    const range = p90Cost - averageCost
    const position = range > 0 ? (eventCost - averageCost) / range : 0
    barFillPercent = Math.min(100, position * 100)
    barColor = position < 0.7 ? indicatorColor.warning : indicatorColor.negative
  } else {
    const range = averageCost - p10Cost
    const position = range > 0 ? (averageCost - eventCost) / range : 0
    barFillPercent = Math.min(100, position * 100)
    barColor = indicatorColor.positive
  }

  const deviationFormatted = `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%`

  return { isAboveAverage, barFillPercent, barColor, deviationFormatted }
}

interface CostDeviationProps {
  eventCost: number
  currency: string
  averageCost: number
  p10Cost: number
  p90Cost: number
}

export function CostDeviation({
  eventCost,
  currency,
  averageCost,
  p10Cost,
  p90Cost,
}: CostDeviationProps) {
  const deviation = getEventCostDeviation(
    eventCost,
    averageCost,
    p10Cost,
    p90Cost,
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-row items-center gap-x-4">
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency('subcent')(eventCost, currency)}
          </span>
          <div
            className={twMerge(
              'flex h-6 w-6 items-center justify-center rounded-sm text-[6px] transition-colors duration-150',
              deviation.barColor,
            )}
          >
            <Circle fontSize="inherit" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="end">
        <p className="text-xs">
          {deviation.deviationFormatted} compared to the average cost for this
          event type
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
