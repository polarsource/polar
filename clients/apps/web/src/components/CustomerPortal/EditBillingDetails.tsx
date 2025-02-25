import { useUpdateCustomerPortal } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import type { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker from '@polar-sh/ui/components/atoms/CountryStatePicker'
import Input from '@polar-sh/ui/components/atoms/Input'
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

const EditBillingDetails = ({
  api,
  customer,
  onSuccess,
}: {
  api: Client
  customer: schemas['CustomerPortalCustomer']
  onSuccess: () => void
}) => {
  const form = useForm<schemas['CustomerPortalCustomerUpdate']>({
    defaultValues: {
      ...customer,
      tax_id: customer.tax_id ? customer.tax_id[0] : null,
    },
  })
  const {
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors },
  } = form

  const country = watch('billing_address.country')

  useEffect(() => {
    if (country !== 'US' && country !== 'CA') {
      setValue('billing_address.state', null)
    }
  }, [country, setValue])

  const updateCustomer = useUpdateCustomerPortal(api)
  const onSubmit = useCallback(
    async (data: schemas['CustomerPortalCustomerUpdate']) => {
      const { error } = await updateCustomer.mutateAsync(data)
      if (error) {
        if (error.detail) {
          setValidationErrors(error.detail, setError)
        }
        return
      }
      onSuccess()
    },
    [updateCustomer, onSuccess, setError],
  )

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-6">
        <FormField
          control={control}
          name="email"
          rules={{
            required: 'This field is required',
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="name"
          rules={{
            required: 'This field is required',
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  type="name"
                  autoComplete="name"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Billing address</FormLabel>
          <FormControl>
            <FormField
              control={control}
              name="billing_address.line1"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => (
                <>
                  <Input
                    type="text"
                    autoComplete="billing address-line1"
                    placeholder="Line 1"
                    className="bg-white shadow-sm"
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </>
              )}
            />
          </FormControl>
          <FormControl>
            <FormField
              control={control}
              name="billing_address.line2"
              render={({ field }) => (
                <>
                  <Input
                    type="text"
                    autoComplete="billing address-line2"
                    placeholder="Line 2"
                    className="bg-white shadow-sm"
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </>
              )}
            />
          </FormControl>

          <div className="grid grid-cols-2 gap-x-2">
            <FormControl>
              <FormField
                control={control}
                name="billing_address.postal_code"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <>
                    <Input
                      type="text"
                      autoComplete="billing postal-code"
                      placeholder="Postal code"
                      className="bg-white shadow-sm"
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </>
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
                  <>
                    <Input
                      type="text"
                      autoComplete="billing address-level2"
                      placeholder="City"
                      className="bg-white shadow-sm"
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </>
                )}
              />
            </FormControl>
          </div>
          <FormControl>
            <FormField
              control={control}
              name="billing_address.country"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => (
                <>
                  <CountryPicker
                    autoComplete="billing country"
                    value={field.value || undefined}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </>
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
                  <>
                    <CountryStatePicker
                      autoComplete="billing address-level1"
                      country={country}
                      value={field.value || undefined}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </>
                )}
              />
            </FormControl>
          )}

          {errors.billing_address?.message && (
            <p className="text-destructive-foreground text-sm">
              {errors.billing_address.message}
            </p>
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
        <Button
          type="submit"
          loading={updateCustomer.isPending}
          disabled={updateCustomer.isPending}
        >
          Update billing details
        </Button>
      </form>
    </Form>
  )
}

export default EditBillingDetails
