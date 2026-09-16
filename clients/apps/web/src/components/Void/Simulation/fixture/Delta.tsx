'use client'

import { Text, TextVariant } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { usd } from './format'

interface DeltaProps {
  /** Change in cents. */
  delta: number
  /** Change relative to the reference; null when there was no reference. */
  ratio?: number | null
  variant?: TextVariant
  suffix?: string
}

export const Delta = ({
  delta,
  ratio,
  variant = 'default',
  suffix,
}: DeltaProps) => {
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus
  const color =
    delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-tertiary'
  const pct =
    ratio === undefined
      ? null
      : ratio === null
        ? 'new'
        : `${Math.round(Math.abs(ratio) * 1000) / 10}%`
  return (
    <Box as="span" display="inline-flex" alignItems="center" columnGap="xs">
      <Box as="span" display="inline-flex" color={color}>
        <Icon size={variant === 'caption' ? 12 : 14} strokeWidth={2.5} />
      </Box>
      <Text variant={variant}>
        {usd(Math.abs(delta))}
        {pct ? ` · ${pct}` : ''}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </Box>
  )
}
