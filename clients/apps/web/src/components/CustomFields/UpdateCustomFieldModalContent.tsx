import { useUpdateCustomField } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { Form } from '@spaire/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import CustomFieldForm from './CustomFieldForm'

interface UpdateCustomFieldModalContentProps {
  customField: schemas['CustomField']
  onCustomFieldUpdated: (customField: schemas['CustomField']) => void
  hideModal: () => void
}

const UpdateCustomFieldModalContent = ({
  customField,
  onCustomFieldUpdated,
  hideModal,
}: UpdateCustomFieldModalContentProps) => {
  const updateCustomField = useUpdateCustomField(customField.id)

  const form = useForm<schemas['CustomFieldUpdate']>({
    defaultValues: {
      ...customField,
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const onSubmit = useCallback(
    async (customFieldUpdate: schemas['CustomFieldUpdate']) => {
      const { data: customField, error } =
        await updateCustomField.mutateAsync(customFieldUpdate)

      if (error) {
        if (isValidationError(error.detail)) {
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
        title: 'Custom Field Updated',
        description: `Custom field ${customField.name} was updated successfully`,
      })
      onCustomFieldUpdated(customField)
    },
    [updateCustomField, onCustomFieldUpdated, setError],
  )

  return (
    <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
      <div>
        <h2 className="text-lg">Update Custom Field</h2>
        <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
          Type cannot be changed.
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <CustomFieldForm update={true} />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="submit"
                loading={updateCustomField.isPending}
                disabled={updateCustomField.isPending}
              >
                Update
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

export default UpdateCustomFieldModalContent
