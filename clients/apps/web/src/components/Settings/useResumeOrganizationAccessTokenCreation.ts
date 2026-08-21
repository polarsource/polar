'use client'

import { useAuth } from '@/hooks/auth'
import { useCreateOrganizationAccessToken } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { type schemas } from '@polar-sh/client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useEffectEvent, useRef } from 'react'
import { toast } from '../Toast/use-toast'
import {
  ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM,
  takePendingOrganizationAccessTokenCreation,
} from './organizationAccessTokenContinuation'

interface UseResumeOrganizationAccessTokenCreationProps {
  organizationId: string
  onSuccess: (created: schemas['OrganizationAccessTokenCreateResponse']) => void
}

export const useResumeOrganizationAccessTokenCreation = ({
  organizationId,
  onSuccess,
}: UseResumeOrganizationAccessTokenCreationProps) => {
  const { currentUser } = useAuth()
  const searchParams = useSearchParams()
  const actionId = searchParams.get(ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM)
  const resumedActionId = useRef<string | null>(null)
  const onResumedSuccess = useEffectEvent(onSuccess)
  const { mutate } = useCreateOrganizationAccessToken(organizationId)

  useEffect(() => {
    const userId = currentUser?.id
    if (!actionId || !userId || resumedActionId.current === actionId) return

    resumedActionId.current = actionId

    const url = new URL(window.location.href)
    url.searchParams.delete(ORGANIZATION_ACCESS_TOKEN_RESUME_PARAM)
    window.history.replaceState(window.history.state, '', url)

    const body = takePendingOrganizationAccessTokenCreation(
      actionId,
      organizationId,
      userId,
    )
    if (!body) {
      toast({
        title: 'Could not resume access token creation',
        description:
          'The saved request is missing, expired, or no longer valid.',
      })
      return
    }

    mutate(body, {
      onSuccess: ({ data, error }) => {
        if (data) {
          onResumedSuccess(data)
          return
        }

        if (error) {
          toast({
            title: 'Could not create access token',
            description: extractApiErrorMessage(error),
          })
        }
      },
      onError: () => {
        toast({
          title: 'Could not create access token',
          description: 'Please try again.',
        })
      },
    })
  }, [actionId, currentUser?.id, mutate, organizationId])
}
