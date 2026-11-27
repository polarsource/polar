import { useCustomerPortalCustomer } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { type schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm, useFormState } from 'react-hook-form'
import {
  BillingDetailsFields,
  type CustomerPortalCustomerUpdate,
  getBillingDetailsValues,
} from './BillingDetailsFields'

const EditBillingDetails = ({ onSuccess }: { onSuccess: () => void }) => {
  const { data: customer, update } = useCustomerPortalCustomer()

  const form = useForm<CustomerPortalCustomerUpdate>({
    defaultValues: customer ? getBillingDetailsValues(customer) : undefined,
  })
  const { control, handleSubmit, setError, reset } = form
  const { isDirty } = useFormState({ control })

  const onSubmit = useCallback(
    async (data: CustomerPortalCustomerUpdate) => {
      try {
        const updatedCustomer = await update.mutateAsync(data)
        reset(getBillingDetailsValues(updatedCustomer))
        onSuccess()
      } catch (e: unknown) {
        if (
          e != null &&
          typeof e === 'object' &&
          'errors' in e &&
          Array.isArray((e as { errors: unknown }).errors)
        ) {
          setValidationErrors(
            (e as { errors: schemas['ValidationError'][] }).errors,
            setError,
          )
        }
      }
    },
    [update, onSuccess, setError, reset],
  )

  if (!customer) {
    return null
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-6">
        <BillingDetailsFields customer={customer} />
        <Button
          type="submit"
          loading={update.isPending}
          disabled={update.isPending || !isDirty}
          className="self-end"
        >
          Update billing details
        </Button>
      </form>
    </Form>
  )
}

export default EditBillingDetails
