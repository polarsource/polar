import { setValidationErrors } from '@/utils/api/errors'
import { api } from '@/utils/client'
import { enums, isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'

const AccountCreateModal = ({
  forOrganizationId,
  returnPath,
}: {
  forOrganizationId: string
  returnPath: string
}) => {
  const form = useForm<schemas['PayoutAccountCreate']>({
    defaultValues: {
      country: 'US',
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const [loading, setLoading] = useState(false)

  const goToOnboarding = useCallback(
    async (payoutAccount: schemas['PayoutAccount']) => {
      setLoading(true)
      const { data, error } = await api.POST(
        '/v1/payout-accounts/{id}/onboarding-link',
        {
          params: {
            path: { id: payoutAccount.id },
            query: { return_path: returnPath },
          },
        },
      )
      setLoading(false)

      if (error) {
        window.location.reload()
        return
      }

      window.location.href = data.url
    },
    [returnPath],
  )

  const onSubmit = useCallback(
    async (data: schemas['PayoutAccountCreate']) => {
      setLoading(true)

      const { data: payoutAccount, error } = await api.POST(
        '/v1/payout-accounts/',
        {
          body: {
            type: 'stripe',
            country: data.country,
            organization_id: forOrganizationId,
          },
        },
      )

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        setLoading(false)
        return
      }

      setLoading(false)
      await goToOnboarding(payoutAccount)
    },
    [setLoading, forOrganizationId, goToOnboarding, setError],
  )

  return (
    <div className="flex flex-col gap-y-6 overflow-auto p-8">
      <h2>Setup payout account</h2>

      <Form {...form}>
        <form
          className="flex flex-col gap-y-4"
          onSubmit={handleSubmit(onSubmit)}
        >
          <AccountCountry />
          {errors.root && (
            <p className="text-destructive-foreground text-sm">
              {errors.root.message}
            </p>
          )}
          <Button
            className="self-start"
            type="submit"
            loading={loading}
            disabled={loading}
          >
            Set up account
          </Button>
        </form>
      </Form>
    </div>
  )
}

const AccountCountry = () => {
  const { control } = useFormContext<schemas['PayoutAccountCreate']>()

  return (
    <FormField
      control={control}
      name="country"
      render={({ field }) => {
        return (
          <FormItem>
            <FormLabel>Country</FormLabel>
            <FormControl>
              <CountryPicker
                value={field.value || undefined}
                onChange={field.onChange}
                allowedCountries={enums.stripeAccountCountryValues}
              />
            </FormControl>
            <FormMessage />
            <FormDescription>
              If this is a personal account, please select your country of
              residence. If this is an organization or business, select the
              country of tax residency.
            </FormDescription>
          </FormItem>
        )
      }}
    />
  )
}

export default AccountCreateModal
