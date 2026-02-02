import { useCreateCustomField } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useCallback } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import CustomFieldForm from './CustomFieldForm'

interface CreateCustomFieldModalContentProps {
  organization: schemas['Organization']
  onCustomFieldCreated: (customField: schemas['CustomField']) => void
  hideModal: () => void
}

const CreateCustomFieldModalContent = ({
  organization,
  onCustomFieldCreated,
  hideModal,
}: CreateCustomFieldModalContentProps) => {
  const createCustomField = useCreateCustomField(organization.id)

  const form = useForm<schemas['CustomFieldCreate']>({
    defaultValues: {
      organization_id: organization.id,
      type: 'text',
      properties: {},
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const onSubmit: SubmitHandler<schemas['CustomFieldCreate']> = useCallback(
    async (customFieldCreate) => {
      const { data: customField, error } =
        await createCustomField.mutateAsync(customFieldCreate)
      if (error) {
        if (error.detail) {
          setValidationErrors(error.detail, setError, 1, [
            'text',
            'number',
            'date',
            'checkbox',
            'select',
          ])
        }
        return
      }
      toast({
        title: 'Custom Field Created',
        description: `Custom field ${customField.name} was created successfully`,
      })
      onCustomFieldCreated(customField)
    },
    [createCustomField, onCustomFieldCreated, setError],
  )

  return (
    <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
      <div>
        <h2 className="text-lg">Create Custom Field</h2>
        <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
          Custom Fields allow you to ask additional information from your
          customers at checkout, and will be available for use in all products
          of your organization.
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <CustomFieldForm update={false} />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="submit"
                loading={createCustomField.isPending}
                disabled={createCustomField.isPending}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                onClick={hideModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default CreateCustomFieldModalContent
