'use client'

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

export function getEventCostDeviation(
  eventCost: number,
  averageCost: number,
  p99Cost: number,
) {
  const deviation =
    averageCost > 0 ? ((eventCost - averageCost) / averageCost) * 100 : 0
  const isAboveAverage = eventCost > averageCost

  let barFillPercent: number
  let barColor: string

  if (isAboveAverage) {
    const range = p99Cost - averageCost
    const position = range > 0 ? (eventCost - averageCost) / range : 0
    barFillPercent = Math.min(100, position * 100)

    if (position < 0.7) {
      barColor = COLORS.amber
    } else {
      barColor = COLORS.red
    }
  } else {
    const position = averageCost > 0 ? eventCost / averageCost : 1
    barFillPercent = Math.min(100, (1 - position) * 100)
    barColor = COLORS.emerald
  }

  const deviationFormatted = `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%`

  return {
    isAboveAverage,
    barFillPercent,
    barColor,
    deviationFormatted,
  }
}

interface CostDeviationBarProps {
  eventCost: number
  averageCost: number
  p99Cost: number
}

export function CostDeviationBar({
  eventCost,
  averageCost,
  p99Cost,
}: CostDeviationBarProps) {
  const deviation = getEventCostDeviation(eventCost, averageCost, p99Cost)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="box-content flex h-1.5 w-12 cursor-help items-center py-2">
          <div className="dark:bg-polar-700 flex h-full w-1/2 justify-end overflow-hidden rounded-l-full bg-gray-200">
            {!deviation.isAboveAverage && (
              <div
                className="h-full rounded-l-full transition-all"
                style={{
                  width: `${deviation.barFillPercent}%`,
                  backgroundColor: deviation.barColor,
                }}
              />
            )}
          </div>

          <div className="dark:bg-polar-500 h-2.5 w-0.5 rounded-full bg-gray-400" />
          <div className="dark:bg-polar-700 h-full w-1/2 overflow-hidden rounded-r-full bg-gray-200">
            {deviation.isAboveAverage && (
              <div
                className="h-full rounded-r-full transition-all"
                style={{
                  width: `${deviation.barFillPercent}%`,
                  backgroundColor: deviation.barColor,
                }}
              />
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="flex flex-col gap-y-2 p-1">
          <div>
            <p className="text-left text-sm font-medium">
              {deviation.deviationFormatted}
            </p>
            <p className="dark:text-polar-400 text-xs text-gray-400">
              compared to average cost for this event type
            </p>
          </div>
          <div className="dark:border-polar-600 border-t border-gray-200 pt-2">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex h-1.5 w-8 items-center">
                <div
                  className="h-full w-1/2 rounded-l-full"
                  style={{ backgroundColor: COLORS.emerald }}
                />
                <div className="dark:bg-polar-500 h-2 w-0.5 bg-gray-400" />
                <div className="dark:bg-polar-600 h-full w-1/2 rounded-r-full bg-gray-300" />
              </div>
              <span className="dark:text-polar-400 text-gray-500">
                Below average
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <div className="flex h-1.5 w-8 items-center">
                <div className="dark:bg-polar-600 h-full w-1/2 rounded-l-full bg-gray-300" />
                <div className="dark:bg-polar-500 h-2 w-0.5 bg-gray-400" />
                <div
                  className="h-full w-1/2 rounded-r-full"
                  style={{ backgroundColor: COLORS.red }}
                />
              </div>
              <span className="dark:text-polar-400 text-gray-500">
                Above average
              </span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
