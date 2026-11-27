import { enums, type schemas } from '@polar-sh/client'
import { Input } from '@polar-sh/orbit'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import CountryStatePicker, {
  COUNTRIES_WITH_FIXED_STATE_OPTIONS,
  getStateLabel,
  hasFixedStateOptions,
} from '@polar-sh/ui/components/atoms/CountryStatePicker'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  getTaxAddressFields,
  type TaxAddressField,
} from '@polar-sh/ui/lib/taxAddressFields'
import { useEffect } from 'react'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'

export type CustomerPortalCustomerUpdate =
  schemas['CustomerPortalCustomerUpdate']

export const getBillingDetailsValues = (
  details: Pick<
    schemas['CustomerPortalCustomer'],
    'billing_name' | 'billing_address' | 'tax_id'
  > & { name?: string | null },
): CustomerPortalCustomerUpdate => ({
  billing_name: details.billing_name || details.name || undefined,
  billing_address: (details.billing_address ?? undefined) as
    | schemas['AddressInput']
    | undefined,
  tax_id: details.tax_id ? details.tax_id[0] : null,
})

export const hasCompleteBillingAddress = (
  address: schemas['CustomerPortalCustomer']['billing_address'],
) =>
  !!address &&
  getTaxAddressFields(address.country).every((field) => !!address[field])

const requiredTaxField = (field: TaxAddressField) => ({
  validate: (
    value: string | null | undefined,
    values: CustomerPortalCustomerUpdate,
  ) => {
    const taxFields = getTaxAddressFields(values.billing_address?.country)
    if (taxFields.includes(field) && !value) {
      return 'This field is required'
    }
    return true
  },
})

const isFixedStateCode = (state: string) =>
  COUNTRIES_WITH_FIXED_STATE_OPTIONS.some((country) =>
    state.startsWith(`${country}-`),
  )

type AddressTextField =
  | 'billing_address.line1'
  | 'billing_address.line2'
  | 'billing_address.postal_code'
  | 'billing_address.city'

const AddressInput = ({
  name,
  placeholder,
  autoComplete,
  taxField,
}: {
  name: AddressTextField
  placeholder: string
  autoComplete: string
  taxField?: TaxAddressField
}) => {
  const { control } = useFormContext<CustomerPortalCustomerUpdate>()
  return (
    <FormControl>
      <FormField
        control={control}
        name={name}
        rules={taxField ? requiredTaxField(taxField) : undefined}
        render={({ field }) => (
          <div className="flex flex-col gap-y-2">
            <Input
              type="text"
              autoComplete={autoComplete}
              placeholder={placeholder}
              className="bg-white shadow-xs"
              {...field}
              value={field.value || ''}
            />
            <FormMessage />
          </div>
        )}
      />
    </FormControl>
  )
}

export const BillingDetailsFields = ({
  customer,
}: {
  customer: schemas['CustomerPortalCustomer']
}) => {
  const { control, getValues, setValue, clearErrors } =
    useFormContext<CustomerPortalCustomerUpdate>()
  const { errors } = useFormState({ control })
  const country = useWatch({ control, name: 'billing_address.country' })

  useEffect(() => {
    const state = getValues('billing_address.state')
    const isValidForCountry = hasFixedStateOptions(country)
      ? state?.startsWith(`${country}-`)
      : !isFixedStateCode(state ?? '')
    if (state && !isValidForCountry) {
      setValue('billing_address.state', null)
    }
    clearErrors([
      'billing_address.line1',
      'billing_address.postal_code',
      'billing_address.city',
      'billing_address.state',
    ])
  }, [country, getValues, setValue, clearErrors])

  const savedState = customer.billing_address?.state
  const showState =
    hasFixedStateOptions(country) ||
    (!!savedState && !isFixedStateCode(savedState))

  return (
    <>
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input
            type="email"
            value={customer.email ?? ''}
            disabled
            readOnly
            className="bg-white shadow-xs"
          />
        </FormControl>
      </FormItem>
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
                placeholder="Company or legal name for invoices (optional)"
                {...field}
                value={field.value || ''}
                className="bg-white shadow-xs"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
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
                className="bg-white shadow-xs"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormItem>
        <FormLabel>Billing address</FormLabel>
        <AddressInput
          name="billing_address.line1"
          placeholder="Line 1"
          autoComplete="billing address-line1"
        />
        <AddressInput
          name="billing_address.line2"
          placeholder="Line 2"
          autoComplete="billing address-line2"
        />
        <div className="grid grid-cols-2 gap-x-3">
          <AddressInput
            name="billing_address.postal_code"
            placeholder="Postal code"
            autoComplete="billing postal-code"
            taxField="postal_code"
          />
          <AddressInput
            name="billing_address.city"
            placeholder="City"
            autoComplete="billing address-level2"
            taxField="city"
          />
        </div>
        {showState && (
          <FormControl>
            <FormField
              control={control}
              name="billing_address.state"
              rules={requiredTaxField('state')}
              render={({ field }) => (
                <div className="flex flex-col gap-y-2">
                  <CountryStatePicker
                    autoComplete="billing address-level1"
                    country={country}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder={getStateLabel(country)}
                  />
                  <FormMessage />
                </div>
              )}
            />
          </FormControl>
        )}
        <FormControl>
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
                  allowedCountries={enums.addressInputCountryValues}
                />
                <FormMessage />
              </div>
            )}
          />
        </FormControl>
        {errors.billing_address?.message && (
          <p className="text-destructive-foreground text-sm">
            {errors.billing_address.message}
          </p>
        )}
      </FormItem>
    </>
  )
}
