import { z } from 'zod'

const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 60_000

interface PendingActionStoreOptions<Payload> {
  keyPrefix: string
  resumeParam: string
  payloadSchema: z.ZodType<Payload>
  maxAgeMs?: number
}

/**
 * Keeps an action the user started in `sessionStorage` across a session
 * refresh, so it can be resumed once they're back. An entry is bound to the
 * user and to one resource, expires, and can only be read once.
 */
export const createPendingActionStore = <Payload>({
  keyPrefix,
  resumeParam,
  payloadSchema,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}: PendingActionStoreOptions<Payload>) => {
  const entrySchema = z.object({
    resourceId: z.string(),
    userId: z.string(),
    createdAt: z.number(),
    payload: payloadSchema,
  })

  const getStorageKey = (actionId: string) => `${keyPrefix}${actionId}`

  const parse = (serialized: string) => {
    try {
      return entrySchema.safeParse(JSON.parse(serialized))
    } catch {
      return null
    }
  }

  return {
    resumeParam,

    save: (
      resourceId: string,
      userId: string,
      payload: Payload,
    ): string | null => {
      const actionId = crypto.randomUUID()
      try {
        sessionStorage.setItem(
          getStorageKey(actionId),
          JSON.stringify({
            resourceId,
            userId,
            createdAt: Date.now(),
            payload,
          }),
        )
        return actionId
      } catch {
        return null
      }
    },

    take: (
      actionId: string,
      resourceId: string,
      userId: string,
    ): Payload | null => {
      const storageKey = getStorageKey(actionId)
      const serialized = sessionStorage.getItem(storageKey)
      sessionStorage.removeItem(storageKey)

      if (!serialized) return null

      const result = parse(serialized)
      if (!result?.success) return null

      const entry = result.data
      const age = Date.now() - entry.createdAt
      if (
        entry.resourceId !== resourceId ||
        entry.userId !== userId ||
        age > maxAgeMs ||
        age < -MAX_CLOCK_SKEW_MS
      ) {
        return null
      }
      return entry.payload
    },

    getResumePath: (actionId: string): string => {
      const url = new URL(window.location.href)
      url.searchParams.set(resumeParam, actionId)
      return `${url.pathname}${url.search}`
    },
  }
}
