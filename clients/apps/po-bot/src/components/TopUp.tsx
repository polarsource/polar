'use client'

import { n } from '@/format'
import { useTree } from '@/hooks/live'
import { useTopUp } from '@/hooks/queries'
import { POOL } from '@/constants'
import { Button } from '@polar-sh/orbit/Button'

/**
 * Refills the organization's pool so the credits-low signal can be watched
 * again. A grant on the root, the same credit side the plan tops up.
 */
export const TopUp = () => {
  const { standing } = useTree().org
  const topUp = useTopUp()
  const full = standing.remaining === null || standing.remaining >= POOL
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={topUp.isPending}
      disabled={full}
      onClick={() => topUp.mutate()}
    >
      {full ? 'Pool full' : `Top up ${n(POOL - standing.remaining!)}`}
    </Button>
  )
}
