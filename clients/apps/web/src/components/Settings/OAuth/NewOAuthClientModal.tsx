import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { useCreateOAuth2Client } from '@/hooks/queries/oauth'
import { OAuth2ClientConfiguration } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

interface NewOAuthClientModalProps {
  hideModal: () => void
}

export const NewOAuthClientModal = ({
  hideModal,
}: NewOAuthClientModalProps) => {
  const form = useForm<OAuth2ClientConfiguration>()

  const { handleSubmit } = form

  const [created, setCreated] = useState<OAuth2ClientConfiguration>()
  const [isCreating, setIsCreating] = useState(false)

  const createOAuth2Client = useCreateOAuth2Client()

  const onSubmit = useCallback(
    async (form: OAuth2ClientConfiguration) => {
      setIsCreating(true)
      const res = await createOAuth2Client.mutateAsync(form)
      setCreated(res)
      setIsCreating(false)
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
            <FieldUrl />
            <FieldSecret isUpdate={false} />
            <FieldEvents />

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
