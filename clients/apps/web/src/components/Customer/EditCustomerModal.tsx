import { MetadataForm } from '@/components/Metadata/MetadataForm'
import {
  WithMetadataEntries,
  entriesToMetadata,
  metadataToEntries,
} from '@/components/Metadata/utils'
import revalidate from '@/app/actions'
import AccessRestricted from '@/components/Finance/AccessRestricted'
import { useHasPermission } from '@/hooks/permissions'
import { useUpdateCustomer } from '@/hooks/queries'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { permissionDeniedMessage } from '@/utils/permissions'
import { isValidationError, schemas } from '@polar-sh/client'
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

type CustomerUpdateForm = WithMetadataEntries<schemas['CustomerUpdate']>

export const EditCustomerModal = ({
  customer,
  onClose,
}: {
  customer:
    | schemas['Customer']
    | schemas['OrderCustomer']
    | schemas['SubscriptionCustomer']
  onClose: () => void
}) => {
  const canManageCustomers = useHasPermission(
    customer.organization_id,
    'customers:manage',
  )

  const form = useForm<CustomerUpdateForm>({
    defaultValues: {
      name: customer.name || '',
      email: customer.email ?? '',
      external_id: customer.external_id || '',
      metadata: metadataToEntries(customer.metadata),
    },
  })

  const updateCustomer = useUpdateCustomer(
    customer.id,
    customer.organization_id,
  )

  const handleUpdateCustomer = (customerUpdate: CustomerUpdateForm) => {
    const data = {
      ...customerUpdate,
      metadata: entriesToMetadata(customerUpdate.metadata),
    }

    updateCustomer.mutateAsync(data).then(({ error }) => {
      if (error) {
        if (error.detail)
          if (isValidationError(error.detail)) {
            setValidationErrors(error.detail, form.setError)
          } else {
            toast({
              title: 'Customer Update Failed',
              description: `Error updating customer ${customer.email ?? customer.name ?? 'customer'}: ${extractApiErrorMessage(error)}`,
            })
          }
        return
      }

      toast({
        title: 'Customer Updated',
        description: `Customer ${customer.email ?? customer.name ?? 'customer'} updated successfully`,
      })
      revalidate(`customer:${customer.id}`)
      onClose()
    })
  }

  if (!canManageCustomers) {
    return (
      <Box flexDirection="column" height="100%">
        <InlineModalHeader hide={onClose}>
          <h2 className="text-xl">Edit Customer</h2>
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
        <h2 className="text-xl">Edit Customer</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-8 px-8 pb-12">
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
                  required:
                    customer.type === 'team' ? false : 'Email is required',
                  validate: (value) => {
                    if (!value) return true
                    return (
                      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
                      'Invalid email address'
                    )
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
              loading={updateCustomer.isPending}
            >
              Save Customer
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
