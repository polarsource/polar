import revalidate from '@/app/actions'
import { useCreateCustomer } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CustomerCreate,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

export const CreateCustomerModal = ({
  organization,
  onClose,
}: {
  organization: Organization
  onClose: () => void
}) => {
  const form = useForm<CustomerCreate>({
    defaultValues: {
      organization_id: organization.id,
      metadata: {},
    },
  })
  const createCustomer = useCreateCustomer(organization.id)

  const handleCreateCustomer = (customerCreate: CustomerCreate) => {
    createCustomer
      .mutateAsync(customerCreate)
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
          </div>
          <Button type="submit" className="self-start">
            Create Customer
          </Button>
        </form>
      </Form>
    </div>
  )
}
