'use client'

import { promptSessionRefresh } from '@/components/SessionRefresh/store'
import { useAuth } from '@/hooks/auth'
import { useCreateOrganizationAccessToken } from '@/hooks/queries'
import {
  extractApiErrorMessage,
  isSessionNotFreshError,
} from '@/utils/api/errors'
import { InlineModalHeader } from '@polar-sh/orbit'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import {
  getOrganizationAccessTokenResumePath,
  savePendingOrganizationAccessTokenCreation,
} from './organizationAccessTokenContinuation'
import {
  AccessTokenForm,
  type AccessTokenCreate,
} from './OrganizationAccessTokensSettings'

interface CreateAccessTokenModalProps {
  organization: schemas['Organization']
  onSuccess: (token: schemas['OrganizationAccessTokenCreateResponse']) => void
  onHide: () => void
  title?: string
}

export const CreateAccessTokenModal = ({
  organization,
  onSuccess,
  onHide,
  title = 'Create Organization Token',
}: CreateAccessTokenModalProps) => {
  const { currentUser } = useAuth()
  const createToken = useCreateOrganizationAccessToken(organization.id)
  const form = useForm<AccessTokenCreate>({
    defaultValues: {
      comment: '',
      expires_in: 'P30D',
      scopes: [],
    },
  })
  const { handleSubmit, reset } = form

  const onCreate = useCallback(
    async (data: AccessTokenCreate) => {
      const body = {
        comment: data.comment ? data.comment : '',
        expires_in:
          data.expires_in === 'no-expiration' ? null : data.expires_in,
        scopes: data.scopes,
      }
      const { data: created, error } = await createToken.mutateAsync(body)
      if (created) {
        onSuccess(created)
        reset({ scopes: [] })
        createToken.reset()
      } else if (error) {
        if (isSessionNotFreshError(error) && currentUser) {
          const actionId = savePendingOrganizationAccessTokenCreation(
            organization.id,
            currentUser.id,
            body,
          )
          if (actionId) {
            promptSessionRefresh({
              returnTo: getOrganizationAccessTokenResumePath(actionId),
            })
            return
          }
        }
        toast({
          title: 'Could not create access token',
          description: extractApiErrorMessage(error),
        })
      }
    },
    [createToken, currentUser, onSuccess, organization.id, reset],
  )

  return (
    <div className="flex flex-col">
      <InlineModalHeader hide={onHide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">{title}</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onCreate)}
            className="max-w-[700px] space-y-8"
          >
            <AccessTokenForm />
            <Button type="submit" loading={createToken.isPending}>
              Create Token
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
