import revalidate from '@/app/actions'
import { MetadataForm } from '@/components/Metadata/MetadataForm'
import {
  WithMetadataEntries,
  entriesToMetadata,
} from '@/components/Metadata/utils'
import AccessRestricted from '@/components/Finance/AccessRestricted'
import { useHasPermission } from '@/hooks/permissions'
import { useCreateCustomer } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { permissionDeniedMessage } from '@/utils/permissions'
import { schemas } from '@polar-sh/client'
import { Button, InlineModalHeader } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Input } from '@polar-sh/orbit'
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

type CustomerCreateForm = WithMetadataEntries<
  schemas['CustomerIndividualCreate']
>

export const CreateCustomerModal = ({
  organization,
  onClose,
}: {
  organization: schemas['Organization']
  onClose: () => void
}) => {
  const canManageCustomers = useHasPermission(
    organization.id,
    'customers:manage',
  )

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
      metadata: entriesToMetadata(customerCreate.metadata),
    }

    createCustomer.mutateAsync(data).then(({ data: customer, error }) => {
      if (error) {
        if (error.detail) {
          setValidationErrors(error.detail, form.setError)
        }
        return
      }
      toast({
        title: 'Customer Created',
        description: `Customer ${customer.email ?? customer.name ?? 'customer'} created successfully`,
      })
      revalidate(`customer:${customer.id}`)
      onClose()
    })
  }

  if (!canManageCustomers) {
    return (
      <Box flexDirection="column" height="100%">
        <InlineModalHeader hide={onClose}>
          <h2 className="text-xl">Create Customer</h2>
        </InlineModalHeader>
        <Box flex={1} flexDirection="column" alignItems="center" padding="xl">
          <AccessRestricted
            message={permissionDeniedMessage('customers:manage')}
          />
        </Box>
      </Box>
    )
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={onClose}>
        <h2 className="text-xl">Create Customer</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-8 px-8 pb-12">
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
                name="external_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>External ID</FormLabel>
                    <FormDescription>
                      An optional ID of the customer in your system. Once set,
                      it can&apos;t be updated.
                    </FormDescription>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <MetadataForm label="Metadata" />
            </div>
            <Button
              type="submit"
              className="self-start"
              loading={createCustomer.isPending}
            >
              Create Customer
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
