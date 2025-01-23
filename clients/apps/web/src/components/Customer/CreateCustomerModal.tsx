import revalidate from '@/app/actions'
import { useCreateCustomer } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CustomerCreate,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { CustomerMetadataForm } from './CustomerMetadataForm'

export type CustomerCreateForm = Omit<CustomerCreate, 'metadata'> & {
  metadata: { key: string; value: string | number | boolean }[]
}

export const CreateCustomerModal = ({
  organization,
  onClose,
}: {
  organization: Organization
  onClose: () => void
}) => {
  const form = useForm<CustomerCreateForm>({
    defaultValues: {
      organization_id: organization.id,
      metadata: [],
    },
  })
  const createCustomer = useCreateCustomer(organization.id)

  const handleCreateCustomer = (customerCreate: CustomerCreateForm) => {
    const data = {
      ...customerCreate,
      metadata: customerCreate.metadata?.reduce(
        (acc, { key, value }) => ({ ...acc, [key]: value }),
        {},
      ),
    }

    createCustomer
      .mutateAsync(data)
      .then(async (customer) => {
        toast({
          title: 'Customer Created',
          description: `Customer ${customer.email} created successfully`,
        })

        revalidate(`customer:${customer.id}`)

        onClose()
      })
      .catch(async (error) => {
        if (error instanceof ResponseError) {
          const body = await error.response.json()
          if (error.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, form.setError)

            toast({
              title: 'Customer Creation Failed',
              description: `Error creating customer: ${validationErrors[0].msg}`,
            })
          } else {
            toast({
              title: 'Customer Creation Failed',
              description: `Error creating customer: ${error.message}`,
            })
          }
        }
      })
  }

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <h2 className="text-xl">Create Customer</h2>
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleCreateCustomer)}
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
                  <FormMessage />
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
              name="metadata"
              render={() => <CustomerMetadataForm />}
            />
          </div>
          <Button type="submit" className="self-start">
            Create Customer
          </Button>
        </form>
      </Form>
    </div>
  )
}
