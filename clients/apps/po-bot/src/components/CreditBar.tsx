'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit/Text'
import { n } from '@/format'
import { useMemberNode } from '@/hooks/live'
import type { Standing } from '@/void'
import { useParams } from 'next/navigation'
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
  const { id } = useParams<{ id?: string }>()
  const member = useMemberNode(id ?? '')
  const shown = credits ?? member.standing
  if (!shown) return null
  const spent = shown.remaining === 0
  const share = Math.min(100, (shown.usage / limit) * 100)
  return (
    <Box flexDirection="column" rowGap="xs" width="100%">
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
