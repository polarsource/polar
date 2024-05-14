import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useCreateOAuth2Client } from '@/hooks/queries/oauth'
import { OAuth2Client, OAuth2ClientConfiguration } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  FieldClientURI,
  FieldLogo,
  FieldName,
  FieldPrivacy,
  FieldRedirectURIs,
  FieldScopes,
  FieldTOS,
} from './OAuthForm'

export interface EnhancedOAuth2ClientConfiguration
  extends Omit<OAuth2ClientConfiguration, 'redirect_uris' | 'scope'> {
  redirect_uris: { uri: string }[]
  scope: string[]
}

interface NewOAuthClientModalProps {
  onSuccess: (client: OAuth2Client) => void
  hideModal: () => void
}

export const NewOAuthClientModal = ({
  onSuccess,
  hideModal,
}: NewOAuthClientModalProps) => {
  const form = useForm<EnhancedOAuth2ClientConfiguration>({
    defaultValues: {
      redirect_uris: [{ uri: '' }],
      scope: [],
    },
  })

  const { handleSubmit } = form

  const [created, setCreated] = useState<OAuth2Client>()
  const [isCreating, setIsCreating] = useState(false)

  const createOAuth2Client = useCreateOAuth2Client()

  const onSubmit = useCallback(
    async (form: EnhancedOAuth2ClientConfiguration) => {
      setIsCreating(true)
      const res = await createOAuth2Client
        .mutateAsync({
          ...form,
          redirect_uris: form.redirect_uris.map(({ uri }) => uri),
          scope: form.scope.join(' '),
        })
        .finally(() => setIsCreating(false))
      setCreated(res)
      hideModal()
      onSuccess(res)
    },
    [hideModal, createOAuth2Client, setCreated, setIsCreating, onSuccess],
  )

  return (
    <div className="flex flex-col overflow-y-auto">
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
            <FieldClientURI />
            <FieldTOS />
            <FieldPrivacy />

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
