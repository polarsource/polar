import { useCreateCustomField } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CustomField,
  CustomFieldCreate,
  CustomFieldType,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import CustomFieldForm from './CustomFieldForm'

interface CreateCustomFieldModalContentProps {
  organization: Organization
  onCustomFieldCreated: (customField: CustomField) => void
  hideModal: () => void
}

const CreateCustomFieldModalContent = ({
  organization,
  onCustomFieldCreated,
  hideModal,
}: CreateCustomFieldModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const createCustomField = useCreateCustomField(organization.id)

  const form = useForm<CustomFieldCreate>({
    defaultValues: {
      organization_id: organization.id,
      type: CustomFieldType.TEXT,
      properties: {},
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const onSubmit: SubmitHandler<CustomFieldCreate> = useCallback(
    async (customFieldCreate) => {
      try {
        setIsLoading(true)
        const customField =
          await createCustomField.mutateAsync(customFieldCreate)
        onCustomFieldCreated(customField)
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
              <Button className="self-start" type="submit" loading={isLoading}>
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
