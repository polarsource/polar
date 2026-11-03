'use client'

import { promptSessionRefresh } from '@/components/SessionRefresh/store'
import { useAuth } from '@/hooks/auth'
import { useCreateOrganizationAccessToken } from '@/hooks/queries'
import {
  extractApiErrorMessage,
  isSessionNotFreshError,
} from '@/utils/api/errors'
import { useCallback } from 'react'
import { toast } from '../Toast/use-toast'
import {
  getOrganizationAccessTokenResumePath,
  savePendingOrganizationAccessTokenCreation,
} from './organizationAccessTokenContinuation'
import type { AccessTokenCreate } from './OrganizationAccessTokensSettings'

export const useSubmitOrganizationAccessToken = (organizationId: string) => {
  const { currentUser } = useAuth()
  const createToken = useCreateOrganizationAccessToken(organizationId)

  const submit = useCallback(
    async (data: AccessTokenCreate) => {
      const body = {
        comment: data.comment ? data.comment : '',
        expires_in:
          data.expires_in === 'no-expiration' ? null : data.expires_in,
        scopes: data.scopes,
      }
      const { data: created, error } = await createToken.mutateAsync(body)
      if (created) {
        createToken.reset()
        return created
      }
      if (!error) return undefined
      if (isSessionNotFreshError(error) && currentUser) {
        const actionId = savePendingOrganizationAccessTokenCreation(
          organizationId,
          currentUser.id,
          body,
        )
        if (actionId) {
          promptSessionRefresh({
            returnTo: getOrganizationAccessTokenResumePath(actionId),
          })
          return undefined
        }
      }
      toast({
        title: 'Could not create access token',
        description: extractApiErrorMessage(error),
      })
      return undefined
    },
    [createToken, currentUser, organizationId],
  )

  return { submit, isPending: createToken.isPending }
}
