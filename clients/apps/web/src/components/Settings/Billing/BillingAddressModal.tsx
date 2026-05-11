'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useOrganizationBillingDetails,
  useUpdateOrganizationBillingDetails,
  type OrganizationBillingDetails,
} from '@/hooks/queries/billing'
import { enums } from '@polar-sh/client'
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
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

export const BillingAddressModal = ({
  organizationId,
  hide,
}: {
  organizationId: string
  hide: () => void
}) => {
  const { data: details } = useOrganizationBillingDetails(organizationId)
  const update = useUpdateOrganizationBillingDetails(organizationId)

  const form = useForm<OrganizationBillingDetails>({
    defaultValues: {
      billing_name: details?.billing_name ?? null,
      billing_address: details?.billing_address ?? null,
      tax_id: details?.tax_id ?? null,
    },
  })

  const { control, handleSubmit, watch, setValue, reset } = form
  // eslint-disable-next-line react-hooks/incompatible-library
  const country = watch('billing_address.country')

  useEffect(() => {
    if (details) {
      reset({
        billing_name: details.billing_name,
        billing_address: details.billing_address,
        tax_id: details.tax_id,
      })
    }
  }, [details, reset])

  useEffect(() => {
    if (country !== 'US' && country !== 'CA') {
      setValue('billing_address.state', null)
    }
  }, [country, setValue])

  const onSubmit = async (data: OrganizationBillingDetails) => {
    try {
      await update.mutateAsync(data)
      toast({
        title: 'Billing details updated',
        description: 'Your billing details have been saved.',
      })
      hide()
    } catch (error) {
      toast({
        title: 'Failed to update billing details',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while updating billing details.',
        variant: 'error',
      })
    }
  }

  return (
    <div className="flex flex-col gap-y-6 p-8">
      <div className="flex flex-col gap-y-1">
        <h3 className="text-xl">Billing address</h3>
        <p className="dark:text-polar-500 text-gray-500">
          The address used on invoices for your Polar subscription
        </p>
      </div>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <FormField
            control={control}
            name="billing_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="organization"
                    placeholder="Company or legal name"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem className="flex flex-col gap-y-3">
            <FormLabel>Address</FormLabel>
            <FormField
              control={control}
              name="billing_address.line1"
              rules={{ required: 'This field is required' }}
              render={({ field }) => (
                <div className="flex flex-col gap-y-2">
                  <Input
                    type="text"
                    autoComplete="billing address-line1"
                    placeholder="Line 1"
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </div>
              )}
            />
            <FormField
              control={control}
              name="billing_address.line2"
              render={({ field }) => (
                <div className="flex flex-col gap-y-2">
                  <Input
                    type="text"
                    autoComplete="billing address-line2"
                    placeholder="Line 2"
                    {...field}
                    value={field.value || ''}
                  />
                  <FormMessage />
                </div>
              )}
            />
            <div className="grid grid-cols-2 gap-x-3">
              <FormField
                control={control}
                name="billing_address.postal_code"
                rules={{ required: 'This field is required' }}
                render={({ field }) => (
                  <div className="flex flex-col gap-y-2">
                    <Input
                      type="text"
                      autoComplete="billing postal-code"
                      placeholder="Postal code"
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </div>
                )}
              />
              <FormField
                control={control}
                name="billing_address.city"
                rules={{ required: 'This field is required' }}
                render={({ field }) => (
                  <div className="flex flex-col gap-y-2">
                    <Input
                      type="text"
                      autoComplete="billing address-level2"
                      placeholder="City"
                      {...field}
                      value={field.value || ''}
                    />
                    <FormMessage />
                  </div>
                )}
              />
            </div>
            <FormField
              control={control}
              name="billing_address.country"
              rules={{ required: 'This field is required' }}
              render={({ field }) => (
                <div className="flex flex-col gap-y-2">
                  <CountryPicker
                    autoComplete="billing country"
                    value={field.value || undefined}
                    onChange={field.onChange}
                    allowedCountries={
                      enums.addressInputCountryValues as unknown as string[]
                    }
                  />
                  <FormMessage />
                </div>
              )}
            />
            {(country === 'US' || country === 'CA') && (
              <FormField
                control={control}
                name="billing_address.state"
                rules={{ required: 'This field is required' }}
                render={({ field }) => (
                  <div className="flex flex-col gap-y-2">
                    <CountryStatePicker
                      autoComplete="billing address-level1"
                      country={country as 'US' | 'CA'}
                      value={field.value || undefined}
                      onChange={field.onChange}
                      placeholder={country === 'US' ? 'State' : 'Province'}
                    />
                    <FormMessage />
                  </div>
                )}
              />
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
          <div className="flex flex-row items-center gap-2">
            <Button
              type="submit"
              loading={update.isPending}
              disabled={update.isPending}
            >
              Save
            </Button>
            <Button variant="ghost" type="button" onClick={hide}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
