import { refresh } from '@/live'
import { topUpOrg } from '@/void'

export const dynamic = 'force-dynamic'

/** Refill the organization's pool, so the credits-low demo can be run again. */
export const POST = async () => {
  const result = await topUpOrg()
  refresh('tree')
  return Response.json(result)
}
