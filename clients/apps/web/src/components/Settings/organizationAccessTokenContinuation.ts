import { enums, type schemas } from '@polar-sh/client'
import { z } from 'zod'

export const ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM =
  'resume_organization_access_token_creation'

const STORAGE_KEY_PREFIX = 'polar:organization-access-token:create:v1:'
const MAX_AGE_MS = 15 * 60 * 1000

export type OrganizationAccessTokenCreateBody = Omit<
  schemas['OrganizationAccessTokenCreate'],
  'organization_id'
>

const organizationAccessTokenCreateBodySchema = z.object({
  comment: z.string(),
  expires_in: z.string().nullable().optional(),
  scopes: z.array(z.enum(enums.availableScopeValues)),
})

const pendingOrganizationAccessTokenCreationSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  body: organizationAccessTokenCreateBodySchema,
})

type PendingOrganizationAccessTokenCreation = z.infer<
  typeof pendingOrganizationAccessTokenCreationSchema
>

const getStorageKey = (actionId: string) => `${STORAGE_KEY_PREFIX}${actionId}`

export const savePendingOrganizationAccessTokenCreation = (
  organizationId: string,
  userId: string,
  body: OrganizationAccessTokenCreateBody,
): string | null => {
  const actionId = crypto.randomUUID()
  const pending: PendingOrganizationAccessTokenCreation = {
    organizationId,
    userId,
    createdAt: Date.now(),
    body,
  }

  try {
    sessionStorage.setItem(getStorageKey(actionId), JSON.stringify(pending))
    return actionId
  } catch {
    return null
  }
}

export const takePendingOrganizationAccessTokenCreation = (
  actionId: string,
  organizationId: string,
  userId: string,
): OrganizationAccessTokenCreateBody | null => {
  const storageKey = getStorageKey(actionId)
  const serialized = sessionStorage.getItem(storageKey)
  sessionStorage.removeItem(storageKey)

  if (!serialized) return null

  const result = pendingOrganizationAccessTokenCreationSchema.safeParse(
    JSON.parse(serialized),
  )
  if (!result.success) return null

  const pending = result.data
  const age = Date.now() - pending.createdAt
  if (
    pending.organizationId !== organizationId ||
    pending.userId !== userId ||
    age > MAX_AGE_MS ||
    age < -60_000
  ) {
    return null
  }
  return pending.body
}

export const getOrganizationAccessTokenResumePath = (actionId: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set(ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM, actionId)
  return `${url.pathname}${url.search}`
}
