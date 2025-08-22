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
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
import { useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

const EditBillingDetails = ({
  api,
  customer,
  onSuccess,
  themingPreset,
}: {
  api: Client
  customer: schemas['CustomerPortalCustomer']
  onSuccess: () => void
  themingPreset: ThemingPresetProps
}) => {
  const form = useForm<schemas['CustomerPortalCustomerUpdate']>({
    defaultValues: {
      billing_name: customer.billing_name || customer.name,
      billing_address: customer.billing_address,
      tax_id: customer.tax_id ? customer.tax_id[0] : null,
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

  const country = watch('billing_address.country')

  useEffect(() => {
    if (country !== 'US' && country !== 'CA') {
      setValue('billing_address.state', null)
    }
  }, [country, setValue])

  const updateCustomer = useUpdateCustomerPortal(api)
  const onSubmit = useCallback(
    async (data: schemas['CustomerPortalCustomerUpdate']) => {
      const { error, data: updatedCustomer } =
        await updateCustomer.mutateAsync(data)
      if (error) {
        if (error.detail) {
          setValidationErrors(error.detail, setError)
        }
        return
      }

      reset({
        billing_name: updatedCustomer.billing_name || updatedCustomer.name,
        billing_address: updatedCustomer.billing_address,
        tax_id: updatedCustomer.tax_id ? updatedCustomer.tax_id[0] : null,
      })

      onSuccess()
    },
    [updateCustomer, onSuccess, setError],
  )

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-6">
        <FormItem>
          <FormLabel>Email (read-only)</FormLabel>
          <FormControl>
            <Input
              type="email"
              value={customer.email}
              disabled
              readOnly
              className={themingPreset.polar.input}
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
                  className={themingPreset.polar.input}
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
                <div className="flex flex-col gap-y-2">
                  <Input
                    type="text"
                    autoComplete="billing address-line1"
                    placeholder="Line 1"
                    className={themingPreset.polar.input}
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </div>
              )}
            />
          </FormControl>
          <FormControl>
            <FormField
              control={control}
              name="billing_address.line2"
              render={({ field }) => (
                <div className="flex flex-col gap-y-2">
                  <Input
                    type="text"
                    autoComplete="billing address-line2"
                    placeholder="Line 2"
                    className={themingPreset.polar.input}
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </div>
              )}
            />
          </FormControl>

          <div className="grid grid-cols-2 gap-x-3">
            <FormControl>
              <FormField
                control={control}
                name="billing_address.postal_code"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <div className="flex flex-col gap-y-2">
                    <Input
                      type="text"
                      autoComplete="billing postal-code"
                      placeholder="Postal code"
                      className={themingPreset.polar.input}
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </div>
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
                  <div className="flex flex-col gap-y-2">
                    <Input
                      type="text"
                      autoComplete="billing address-level2"
                      placeholder="City"
                      className={themingPreset.polar.input}
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </div>
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
                <div className="flex flex-col gap-y-2">
                  <CountryPicker
                    autoComplete="billing country"
                    value={field.value || undefined}
                    onChange={field.onChange}
                    className={themingPreset.polar.dropdown}
                    itemClassName={themingPreset.polar.dropdownItem}
                  />
                  <FormMessage />
                </div>
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
                  <div className="flex flex-col gap-y-2">
                    <CountryStatePicker
                      autoComplete="billing address-level1"
                      country={country}
                      value={field.value || undefined}
                      onChange={field.onChange}
                      className={themingPreset.polar.dropdown}
                      itemClassName={themingPreset.polar.dropdownItem}
                    />
                    <FormMessage />
                  </div>
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
                  className={themingPreset.polar.input}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          loading={updateCustomer.isPending}
          disabled={updateCustomer.isPending || !isDirty}
          className={twMerge('self-start', themingPreset.polar.button)}
        >
          Update Billing Details
        </Button>
      </form>
    </Form>
  )
}

export default EditBillingDetails
