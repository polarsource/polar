import { useUpdateCustomer } from '@/hooks/queries'
import { ArrowBackOutlined } from '@mui/icons-material'
import { Customer, CustomerUpdate } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from 'polarkit/components/ui/form'
import { useForm } from 'react-hook-form'

export const EditCustomerModal = ({
  customer,
  onClose,
}: {
  customer: Customer
  onClose: () => void
}) => {
  const form = useForm<CustomerUpdate>({
    defaultValues: {
      name: customer.name || '',
      email: customer.email || '',
    },
  })

  const updateCustomer = useUpdateCustomer(
    customer.id,
    customer.organization_id,
  )

  const handleUpdateCustomer = async (customerUpdate: CustomerUpdate) => {
    await updateCustomer.mutateAsync(customerUpdate)
    onClose()
  }

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowBackOutlined fontSize="small" />
        </Button>
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
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="self-start">
            Save Customer
          </Button>
        </form>
      </Form>
    </div>
  )
}
