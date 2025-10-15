import revalidate from '@/app/actions'
import { useUpdateCustomer } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { CustomerMetadataForm } from './CustomerMetadataForm'

export type CustomerUpdateForm = Omit<schemas['CustomerUpdate'], 'metadata'> & {
  metadata: { key: string; value: string | number | boolean }[]
}

export const EditCustomerModal = ({
  customer,
  onClose,
}: {
  customer: schemas['Customer']
  onClose: () => void
}) => {
  const form = useForm<CustomerUpdateForm>({
    defaultValues: {
      name: customer.name || '',
      email: customer.email || '',
      external_id: customer.external_id || '',
      metadata: Object.entries(customer.metadata).map(([key, value]) => ({
        key,
        value,
      })),
    },
  })

  const updateCustomer = useUpdateCustomer(
    customer.id,
    customer.organization_id,
  )

  const handleUpdateCustomer = (customerUpdate: CustomerUpdateForm) => {
    const data = {
      ...customerUpdate,
      metadata: customerUpdate.metadata?.reduce(
        (acc, { key, value }) => ({ ...acc, [key]: value }),
        {},
      ),
    }

    updateCustomer.mutateAsync(data).then(({ error }) => {
      if (error) {
        if (error.detail)
          if (isValidationError(error.detail)) {
            setValidationErrors(error.detail, form.setError)
          } else {
            toast({
              title: 'Customer Update Failed',
              description: `Error updating customer ${customer.email}: ${error.detail}`,
            })
          }
        return
      }

      toast({
        title: 'Customer Updated',
        description: `Customer ${customer.email} updated successfully`,
      })
      revalidate(`customer:${customer.id}`)
      onClose()
    })
  }

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <h2 className="text-xl">Edit Customer</h2>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleUpdateCustomer)}
          className="flex flex-col gap-8"
        >
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel> Name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email address',
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="external_id"
              disabled={!!customer.external_id}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External ID</FormLabel>
                  <FormDescription>
                    An optional ID of the customer in your system. Once set, it
                    can&apos;t be updated.
                  </FormDescription>
                  <FormControl>
                    <Input {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metadata"
              render={() => <CustomerMetadataForm />}
            />
          </div>
          <Button
            type="submit"
            className="self-start"
            loading={updateCustomer.isPending}
          >
            Save Customer
          </Button>
        </form>
      </Form>
    </div>
  )
}
