'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { n } from '@/format'
import type { Standing } from '@/void'
import { useContext } from 'react'
import { LiveContext } from './Live'
import { Meter } from './Meter'

/**
 * Used against a limit. The org's limit is what the plan grants; a member's
 * is their cap. Without `credits` it shows the live member balance.
 */
export const CreditBar = ({
  credits,
  limit,
}: {
  credits?: Standing
  limit: number
}) => {
  const live = useContext(LiveContext)
  const shown = credits ?? live?.member.standing
  if (!shown) return null
  const spent = shown.remaining === 0
  const share = Math.min(100, (shown.usage / limit) * 100)
  return (
    <Box flexDirection="column" rowGap="xs">
      <Box justifyContent="between" alignItems="baseline" columnGap="m">
        <Text
          variant="caption"
          color={spent ? 'danger' : 'default'}
          tabularNums
        >
          {spent ? 'Cap reached' : `${n(shown.usage)} used`}
        </Text>
        <Text variant="caption" color="muted" tabularNums>
          {n(limit)} credits
        </Text>
      </Box>
      <Meter share={share} spent={spent} />
    </Box>
  )
}
