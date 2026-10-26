import { createPendingActionStore } from '@/utils/pendingAction'
import { enums, type schemas } from '@polar-sh/client'
import { z } from 'zod'

export const ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM =
  'resume_organization_access_token_creation'

export type OrganizationAccessTokenCreateBody = Omit<
  schemas['OrganizationAccessTokenCreate'],
  'organization_id'
>

const organizationAccessTokenCreateBodySchema = z.object({
  comment: z.string(),
  expires_in: z.string().nullable().optional(),
  scopes: z.array(z.enum(enums.availableScopeValues)),
})

const pendingOrganizationAccessTokenCreations = createPendingActionStore({
  keyPrefix: 'polar:organization-access-token:create:v2:',
  resumeParam: ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM,
  payloadSchema: organizationAccessTokenCreateBodySchema,
})

export const savePendingOrganizationAccessTokenCreation = (
  organizationId: string,
  userId: string,
  body: OrganizationAccessTokenCreateBody,
): string | null =>
  pendingOrganizationAccessTokenCreations.save(organizationId, userId, body)

export const takePendingOrganizationAccessTokenCreation = (
  actionId: string,
  organizationId: string,
  userId: string,
): OrganizationAccessTokenCreateBody | null =>
  pendingOrganizationAccessTokenCreations.take(actionId, organizationId, userId)

export const getOrganizationAccessTokenResumePath =
  pendingOrganizationAccessTokenCreations.getResumePath
