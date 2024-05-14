import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useEditOAuth2Client } from '@/hooks/queries/oauth'
import { OAuth2Client, OAuth2ClientConfigurationUpdate } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  FieldLogo,
  FieldName,
  FieldPrivacy,
  FieldRedirectURIs,
  FieldScopes,
  FieldTOS,
} from './OAuthForm'

export interface EnhancedOAuth2ClientConfigurationUpdate
  extends Omit<OAuth2ClientConfigurationUpdate, 'redirect_uris'> {
  redirect_uris: { uri: string }[]
}

interface EditOAuthClientModalProps {
  client: OAuth2Client
  hideModal: () => void
}

export const EditOAuthClientModal = ({
  client,
  hideModal,
}: EditOAuthClientModalProps) => {
  const form = useForm<EnhancedOAuth2ClientConfigurationUpdate>({
    defaultValues: {
      ...client,
      redirect_uris: client.redirect_uris.map((uri) => ({ uri })),
    },
  })

  const { handleSubmit } = form

  const [created, setCreated] =
    useState<EnhancedOAuth2ClientConfigurationUpdate>()
  const [isUpdating, setIsUpdating] = useState(false)

  const createOAuth2Client = useEditOAuth2Client()

  const onSubmit = useCallback(
    async (form: EnhancedOAuth2ClientConfigurationUpdate) => {
      setIsUpdating(true)
      const res = await createOAuth2Client
        .mutateAsync({
          clientId: client.client_id,
          oAuth2ClientConfigurationUpdate: {
            ...form,
            redirect_uris: form.redirect_uris.map(({ uri }) => uri),
          },
        })
        .finally(() => setIsUpdating(false))
      setCreated(res)
      hideModal()
    },
    [hideModal, createOAuth2Client, setCreated, setIsUpdating, client],
  )

  return (
    <div className="flex flex-col">
      <InlineModalHeader hide={hideModal}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Edit OAuth App</h2>
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
            <FieldTOS />
            <FieldPrivacy />

            <Button
              type="submit"
              loading={isUpdating}
              disabled={Boolean(created)}
            >
              Update
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
