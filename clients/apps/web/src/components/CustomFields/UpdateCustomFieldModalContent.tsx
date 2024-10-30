import { useUpdateCustomField } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CustomField,
  CustomFieldUpdate,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import CustomFieldForm from './CustomFieldForm'

interface UpdateCustomFieldModalContentProps {
  customField: CustomField
  onCustomFieldUpdated: (customField: CustomField) => void
  hideModal: () => void
}

const UpdateCustomFieldModalContent = ({
  customField,
  onCustomFieldUpdated,
  hideModal,
}: UpdateCustomFieldModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const updateCustomField = useUpdateCustomField(customField.id)

  const form = useForm<CustomFieldUpdate>({
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
    async (customFieldUpdate: CustomFieldUpdate) => {
      try {
        setIsLoading(true)
        const customField =
          await updateCustomField.mutateAsync(customFieldUpdate)
        onCustomFieldUpdated(customField)
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError, 1)
          }
        }
      } finally {
        setIsLoading(false)
      }
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
              <Button className="self-start" type="submit" loading={isLoading}>
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
