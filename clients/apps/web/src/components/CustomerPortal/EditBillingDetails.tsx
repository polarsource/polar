import { useCustomerPortalCustomer } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { enums, type schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import { Input } from '@polar-sh/orbit'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'

type CustomerPortalCustomerUpdate = schemas['CustomerPortalCustomerUpdate']

const EditBillingDetails = ({ onSuccess }: { onSuccess: () => void }) => {
  const { data: customer, update } = useCustomerPortalCustomer()

  const form = useForm<CustomerPortalCustomerUpdate>({
    defaultValues: {
      billing_name: customer?.billing_name || customer?.name,
      billing_address: customer?.billing_address as schemas['AddressInput'],
      tax_id: customer?.tax_id ? customer.tax_id[0] : null,
    },
  })

  const {
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = form

  // eslint-disable-next-line react-hooks/incompatible-library
  const country = watch('billing_address.country')

  useEffect(() => {
    if (country !== 'US' && country !== 'CA') {
      setValue('billing_address.state', null)
    }
  }, [country, setValue])

  const onSubmit = useCallback(
    async (data: CustomerPortalCustomerUpdate) => {
      try {
        const updatedCustomer = await update.mutateAsync(data)

        reset({
          billing_name: updatedCustomer.billing_name || updatedCustomer.name,
          billing_address: updatedCustomer.billing_address as
            | schemas['AddressInput']
            | null,
          tax_id: updatedCustomer.tax_id ? updatedCustomer.tax_id[0] : null,
        })

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
      <Box
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        flexDirection="column"
        rowGap="xl"
      >
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input
              type="email"
              value={customer.email ?? ''}
              disabled
              readOnly
            />
          </FormControl>
        </FormItem>
        <FormField
          control={control}
          name="billing_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Billing Name</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="organization"
                  placeholder="Company or legal name for invoices (optional)"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem className="flex flex-col gap-y-3">
          <FormLabel>Billing address</FormLabel>
          <FormControl>
            <FormField
              control={control}
              name="billing_address.line1"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => (
                <Box flexDirection="column" rowGap="s">
                  <Input
                    type="text"
                    autoComplete="billing address-line1"
                    placeholder="Line 1"
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </Box>
              )}
            />
          </FormControl>
          <FormControl>
            <FormField
              control={control}
              name="billing_address.line2"
              render={({ field }) => (
                <Box flexDirection="column" rowGap="s">
                  <Input
                    type="text"
                    autoComplete="billing address-line2"
                    placeholder="Line 2"
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </Box>
              )}
            />
          </FormControl>

          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            columnGap="m"
          >
            <FormControl>
              <FormField
                control={control}
                name="billing_address.postal_code"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <Box flexDirection="column" rowGap="s">
                    <Input
                      type="text"
                      autoComplete="billing postal-code"
                      placeholder="Postal code"
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </Box>
                )}
              />
            </FormControl>
            <FormControl>
              <FormField
                control={control}
                name="billing_address.city"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <Box flexDirection="column" rowGap="s">
                    <Input
                      type="text"
                      autoComplete="billing address-level2"
                      placeholder="City"
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </Box>
                )}
              />
            </FormControl>
          </Box>
          <FormControl>
            <FormField
              control={control}
              name="billing_address.country"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => (
                <Box flexDirection="column" rowGap="s">
                  <CountryPicker
                    autoComplete="billing country"
                    value={field.value || undefined}
                    onChange={field.onChange}
                    allowedCountries={enums.addressInputCountryValues}
                  />
                  <FormMessage />
                </Box>
              )}
            />
          </FormControl>
          {(country === 'US' || country === 'CA') && (
            <FormControl>
              <FormField
                control={control}
                name="billing_address.state"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <Box flexDirection="column" rowGap="s">
                    <CountryStatePicker
                      autoComplete="billing address-level1"
                      country={country}
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder={country === 'US' ? 'State' : 'Province'}
                    />
                    <FormMessage />
                  </Box>
                )}
              />
            </FormControl>
          )}

          {errors.billing_address?.message && (
            <Text color="danger">{errors.billing_address.message}</Text>
          )}
        </FormItem>
        <FormField
          control={control}
          name="tax_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax ID</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="off"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Box alignSelf="start">
          <Button
            type="submit"
            loading={update.isPending}
            disabled={update.isPending || !isDirty}
          >
            Update billing details
          </Button>
        </Box>
      </Box>
    </Form>
  )
}

export default EditBillingDetails
