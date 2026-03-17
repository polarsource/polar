'use client'

import { formatCurrency } from '@polar-sh/currency'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'

const COLORS = {
  emerald: 'hsl(142, 69%, 58%)',
  amber: 'hsl(44, 100%, 50%)',
  red: 'hsl(0, 84%, 60%)',
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
    barColor = position < 0.7 ? COLORS.amber : COLORS.red
  } else {
    const range = averageCost - p10Cost
    const position = range > 0 ? (averageCost - eventCost) / range : 0
    barFillPercent = Math.min(100, position * 100)
    barColor = COLORS.emerald
  }

  const deviationFormatted = `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%`

  return { isAboveAverage, barFillPercent, barColor, deviationFormatted }
}

interface CostDeviationBarProps {
  eventCost: number
  currency: string
  averageCost: number
  p10Cost: number
  p90Cost: number
}

export function CostDeviationBar({
  eventCost,
  currency,
  averageCost,
  p10Cost,
  p90Cost,
}: CostDeviationBarProps) {
  const deviation = getEventCostDeviation(
    eventCost,
    averageCost,
    p10Cost,
    p90Cost,
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-help flex-row items-center gap-x-4">
          <span className="font-mono text-xs tabular-nums">
            {formatCurrency('subcent')(eventCost, currency)}
          </span>
          <div className="flex h-1 w-8 items-center">
            <div className="dark:bg-polar-600 flex h-full w-1/2 justify-end overflow-hidden rounded-l-full bg-gray-200">
              {!deviation.isAboveAverage && (
                <div
                  className="h-full rounded-l-full transition-all duration-300"
                  style={{
                    width: `${deviation.barFillPercent}%`,
                    backgroundColor: deviation.barColor,
                  }}
                />
              )}
            </div>
            <div className="dark:bg-polar-700 h-full w-1/2 overflow-hidden rounded-r-full bg-gray-200">
              {deviation.isAboveAverage && (
                <div
                  className="h-full rounded-r-full transition-all duration-300"
                  style={{
                    width: `${deviation.barFillPercent}%`,
                    backgroundColor: deviation.barColor,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-xs">
        <p className="dark:text-polar-400 text-xs text-gray-400">
          vs. average cost for this event type
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
