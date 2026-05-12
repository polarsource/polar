'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useCreateOrganizationAccessToken } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
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
      const { data: created } = await createToken.mutateAsync({
        comment: data.comment ? data.comment : '',
        expires_in:
          data.expires_in === 'no-expiration' ? null : data.expires_in,
        scopes: data.scopes,
      })
      if (created) {
        onSuccess(created)
        reset({ scopes: [] })
        createToken.reset()
      }
    },
    [createToken, onSuccess, reset],
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
            <Button type="submit">Create Token</Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
