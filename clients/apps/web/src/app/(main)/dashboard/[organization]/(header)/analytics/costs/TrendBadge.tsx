'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { fmtPct } from './utils'

interface TrendBadgeProps {
  delta: number
  pct: number
  currentStart: Date
  currentEnd: Date
  prevStart: Date
  prevEnd: Date
}

export function TrendBadge({
  delta,
  pct,
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
}: TrendBadgeProps) {
  const isUp = delta > 0
  const isDown = delta < 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Box
          as="span"
          display="inline-flex"
          width="fit-content"
          alignItems="center"
          columnGap="xs"
          paddingHorizontal="s"
          borderRadius="full"
          cursor="default"
          backgroundColor={
            isUp
              ? 'background-danger'
              : isDown
                ? 'background-success'
                : 'background-card'
          }
          color={
            isUp ? 'text-danger' : isDown ? 'text-success' : 'text-tertiary'
          }
        >
          {isUp ? (
            <ArrowUpRight className="size-3" />
          ) : isDown ? (
            <ArrowDownRight className="size-3" />
          ) : (
            <Minus className="size-3" />
          )}
          <Text as="span" variant="label" color="inherit" tabularNums>
            {fmtPct(pct)}
          </Text>
        </Box>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1">
        <Text as="span" variant="default">
          <FormattedInterval
            startDatetime={currentStart}
            endDatetime={currentEnd}
            hideCurrentYear={false}
          />
        </Text>
        <Text as="span" variant="default" color="muted">
          vs{' '}
          <FormattedInterval
            startDatetime={prevStart}
            endDatetime={prevEnd}
            hideCurrentYear={false}
          />
        </Text>
      </TooltipContent>
    </Tooltip>
  )
}
