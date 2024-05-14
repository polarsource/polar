import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useDeleteOAuthClient,
  useEditOAuth2Client,
} from '@/hooks/queries/oauth'
import { OAuth2Client, OAuth2ClientConfigurationUpdate } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  FieldClientID,
  FieldClientSecret,
  FieldClientURI,
  FieldLogo,
  FieldName,
  FieldPrivacy,
  FieldRedirectURIs,
  FieldScopes,
  FieldTOS,
} from './OAuthForm'

export interface EnhancedOAuth2ClientConfigurationUpdate
  extends Omit<OAuth2ClientConfigurationUpdate, 'redirect_uris' | 'scope'> {
  redirect_uris: { uri: string }[]
  scope: string[]
}

interface EditOAuthClientModalProps {
  client: OAuth2Client
  hideModal: () => void
}

export const EditOAuthClientModal = ({
  client,
  hideModal,
}: EditOAuthClientModalProps) => {
  const router = useRouter()

  const {
    hide: hideDeleteModal,
    isShown: isArchiveModalShown,
    show: showArchiveModal,
  } = useModal()

  const form = useForm<EnhancedOAuth2ClientConfigurationUpdate>({
    defaultValues: {
      ...client,
      redirect_uris: client.redirect_uris.map((uri) => ({ uri })),
      scope: client.scope?.split(' ') ?? [],
    },
  })

  const { handleSubmit } = form

  const [updated, setUpdated] = useState<OAuth2ClientConfigurationUpdate>()
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
            scope: form.scope.join(' '),
          },
        })
        .finally(() => setIsUpdating(false))
      setUpdated(res)
      hideModal()
    },
    [hideModal, createOAuth2Client, setUpdated, setIsUpdating, client],
  )

  const deleteOAuthClient = useDeleteOAuthClient()

  const handleDeleteOAuthClient = useCallback(async () => {
    await deleteOAuthClient.mutateAsync(client.client_id)
    hideDeleteModal()
    hideModal()
    router.push(`/settings`)
  }, [hideDeleteModal, router, hideModal, client, deleteOAuthClient])

  return (
    <div className="flex flex-col overflow-y-auto">
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
            <FieldClientID clientId={client.client_id} />
            <FieldClientSecret clientSecret={client.client_secret} />
            <FieldLogo />
            <FieldRedirectURIs />
            <FieldScopes />
            <FieldClientURI />
            <FieldTOS />
            <FieldPrivacy />

            <ShadowBoxOnMd className="flex flex-col gap-y-8 md:bg-gray-100">
              <div className="flex flex-row items-start justify-between">
                <div className="flex flex-col gap-y-1">
                  <h3 className="dark:text-polar-50 font-medium text-gray-950">
                    Delete OAuth Application
                  </h3>
                  <p className="dark:text-polar-500 text-sm text-gray-500">
                    This action will delete the OAuth Application configuration
                    permanently
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    showArchiveModal()
                  }}
                >
                  Delete
                </Button>
              </div>
              <ConfirmModal
                title="Delete OAuth Application"
                description={
                  'This action will delete the OAuth Application configuration permentnly. Are you sure?'
                }
                destructiveText="Delete"
                onConfirm={handleDeleteOAuthClient}
                isShown={isArchiveModalShown}
                hide={hideDeleteModal}
                destructive
              />
            </ShadowBoxOnMd>

            <Button
              type="submit"
              loading={isUpdating}
              disabled={Boolean(updated)}
            >
              Update
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
