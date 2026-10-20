import { z } from 'zod'

export const AGENT_CLAIM_RESUME_PARAM = 'resume_claim'

const STORAGE_KEY_PREFIX = 'polar:agent-claim:confirm:v1:'
const MAX_AGE_MS = 15 * 60 * 1000

const pendingAgentClaimSchema = z.object({
  linkToken: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  code: z.string(),
})

type PendingAgentClaim = z.infer<typeof pendingAgentClaimSchema>

const getStorageKey = (actionId: string) => `${STORAGE_KEY_PREFIX}${actionId}`

export const savePendingAgentClaim = (
  linkToken: string,
  userId: string,
  code: string,
): string | null => {
  const actionId = crypto.randomUUID()
  const pending: PendingAgentClaim = {
    linkToken,
    userId,
    createdAt: Date.now(),
    code,
  }

  try {
    sessionStorage.setItem(getStorageKey(actionId), JSON.stringify(pending))
    return actionId
  } catch {
    return null
  }
}

export const takePendingAgentClaim = (
  actionId: string,
  linkToken: string,
  userId: string,
): string | null => {
  const storageKey = getStorageKey(actionId)
  const serialized = sessionStorage.getItem(storageKey)
  sessionStorage.removeItem(storageKey)

  if (!serialized) return null

  const result = pendingAgentClaimSchema.safeParse(JSON.parse(serialized))
  if (!result.success) return null

  const pending = result.data
  const age = Date.now() - pending.createdAt
  if (
    pending.linkToken !== linkToken ||
    pending.userId !== userId ||
    age > MAX_AGE_MS ||
    age < -60_000
  ) {
    return null
  }
  return pending.code
}

export const getAgentClaimResumePath = (actionId: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set(AGENT_CLAIM_RESUME_PARAM, actionId)
  return `${url.pathname}${url.search}`
}
