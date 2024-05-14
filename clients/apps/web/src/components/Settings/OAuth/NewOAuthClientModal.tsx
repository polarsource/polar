import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useCreateOAuth2Client } from '@/hooks/queries/oauth'
import { OAuth2ClientConfiguration } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  FieldLogo,
  FieldName,
  FieldRedirectURIs,
  FieldScopes,
} from './OAuthForm'

export interface EnhancedOAuth2ClientConfiguration
  extends Omit<OAuth2ClientConfiguration, 'redirect_uris'> {
  redirect_uris: { uri: string }[]
}

interface NewOAuthClientModalProps {
  hideModal: () => void
}

export const NewOAuthClientModal = ({
  hideModal,
}: NewOAuthClientModalProps) => {
  const form = useForm<EnhancedOAuth2ClientConfiguration>({
    defaultValues: {
      redirect_uris: [{ uri: '' }],
    },
  })

  const { handleSubmit } = form

  const [created, setCreated] = useState<EnhancedOAuth2ClientConfiguration>()
  const [isCreating, setIsCreating] = useState(false)

  const createOAuth2Client = useCreateOAuth2Client()

  const onSubmit = useCallback(
    async (form: EnhancedOAuth2ClientConfiguration) => {
      setIsCreating(true)
      const res = await createOAuth2Client
        .mutateAsync({
          ...form,
          redirect_uris: form.redirect_uris.map(({ uri }) => uri),
        })
        .finally(() => setIsCreating(false))
      setCreated(res)
      hideModal()
    },
    [hideModal, createOAuth2Client, setCreated, setIsCreating],
  )

  return (
    <div className="flex flex-col">
      <InlineModalHeader hide={hideModal}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">New OAuth App</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-[700px] space-y-8"
          >
            <FieldName />
            <FieldLogo />
            <FieldRedirectURIs />
            <FieldScopes />

            <Button
              type="submit"
              loading={isCreating}
              disabled={Boolean(created)}
            >
              Create
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
