import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useDeleteOAuthClient,
  useUpdateOAuth2Client,
} from '@/hooks/queries/oauth'
import {
  OAuth2Client,
  OAuth2ClientConfigurationUpdate,
  ResponseError,
} from '@polar-sh/api'
import Button from 'polarkit/components/atoms/button'
import { ShadowBoxOnMd } from 'polarkit/components/atoms/shadowbox'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  FieldClientID,
  FieldClientSecret,
  FieldClientType,
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
  onSuccess: (client: OAuth2Client) => void
  onDelete: (client: OAuth2Client) => void
  onHide: () => void
}

export const EditOAuthClientModal = ({
  client,
  onSuccess,
  onDelete,
  onHide,
}: EditOAuthClientModalProps) => {
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

  const updateOAuth2Client = useUpdateOAuth2Client()

  const onSubmit = useCallback(
    async (form: EnhancedOAuth2ClientConfigurationUpdate) => {
      setIsUpdating(true)

      try {
        const res = await updateOAuth2Client.mutateAsync({
          clientId: client.client_id,
          body: {
            ...form,
            redirect_uris: form.redirect_uris.map(({ uri }) => uri),
            scope: form.scope.join(' '),
          },
        })

        toast({
          title: 'OAuth App Updated',
          description: `OAuth App ${client.client_name} was updated successfully`,
        })

        setUpdated(res)
        onSuccess(res)
      } catch (e) {
        if (e instanceof ResponseError) {
          toast({
            title: 'OAuth App Update Failed',
            description: `Error updating OAuth App: ${e.message}`,
          })
        }
      } finally {
        setIsUpdating(false)
      }
    },
    [onSuccess, updateOAuth2Client, setUpdated, setIsUpdating, client],
  )

  const deleteOAuthClient = useDeleteOAuthClient()

  const handleDeleteOAuthClient = useCallback(async () => {
    try {
      await deleteOAuthClient.mutateAsync(client.client_id)

      toast({
        title: 'OAuth App Deleted',
        description: `OAuth App ${client.client_name} was deleted successfully`,
      })

      hideDeleteModal()
      onDelete(client)
    } catch (e) {
      if (e instanceof ResponseError) {
        toast({
          title: 'OAuth App Deletion Failed',
          description: `Error deleting OAuth App: ${e.message}`,
        })
      }
    }
  }, [hideDeleteModal, onDelete, client, deleteOAuthClient])

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={onHide}>
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
            <FieldClientType />
            <FieldLogo />
            <FieldRedirectURIs />
            <FieldScopes />
            <FieldClientURI />
            <FieldTOS />
            <FieldPrivacy />

            <ShadowBoxOnMd className="flex flex-col gap-y-8 md:bg-gray-100">
              <div className="flex flex-row items-start justify-between">
                <div className="flex flex-col gap-y-1">
                  <h3 className="font-medium text-gray-950 dark:text-white">
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
