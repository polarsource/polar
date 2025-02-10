import { ACCOUNT_TYPE_DISPLAY_NAMES } from '@/utils/account'
import { getValidationErrorsMap } from '@/utils/api/errors'
import { api } from '@/utils/client'
import { CONFIG } from '@/utils/config'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import CountryPicker from '@polar-sh/ui/components/atoms/CountryPicker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { useState } from 'react'

const stripeConnectWhitelist = CONFIG.STRIPE_COUNTRIES_WHITELIST_CSV.split(',')

const AccountCreateModal = ({
  forOrganizationId,
  forUserId,
  returnPath,
}: {
  forOrganizationId?: string
  forUserId?: string
  returnPath: string
}) => {
  const [accountType, setAccountType] =
    useState<schemas['AccountType']>('stripe')
  const [country, setCountry] = useState<string>('US')
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string[]>
  >({})
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const [loading, setLoading] = useState(false)

  const resetErrors = () => {
    setErrorMessage(undefined)
    setValidationErrors({})
  }

  const onChangeAccountType = (value: string) => {
    resetErrors()
    setAccountType(value as schemas['AccountType'])
  }

  const onChangeCountry = (countryCode: string) => {
    resetErrors()
    setCountry(countryCode)
  }

  const onConfirm = async () => {
    setLoading(true)

    const { data: account, error } = await api.POST('/v1/accounts', {
      body: {
        account_type: accountType,
        country,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(getValidationErrorsMap(error.detail))
      } else {
        setErrorMessage(error.detail)
      }
      return
    }

    if (forOrganizationId) {
      await api.PATCH('/v1/organizations/{id}/account', {
        params: { path: { id: forOrganizationId } },
        body: { account_id: account.id },
      })
    }
    if (forUserId) {
      await api.PATCH('/v1/users/me/account', {
        body: { account_id: account.id },
      })
    }

    setLoading(false)
    await goToOnboarding(account)
  }

  const goToOnboarding = async (account: schemas['Account']) => {
    setLoading(true)
    const { data, error } = await api.POST(
      '/v1/accounts/{id}/onboarding_link',
      {
        params: {
          path: { id: account.id },
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
  }

  return (
    <>
      <div className="flex flex-col gap-y-6 overflow-auto p-8">
        <h2>Setup payout account</h2>
        <form className="flex flex-col gap-y-4">
          <div className="space-y-4">
            <div>
              <Select onValueChange={onChangeAccountType}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={ACCOUNT_TYPE_DISPLAY_NAMES[accountType]}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    key={'stripe'}
                    onClick={() => setAccountType('stripe')}
                    value={'stripe'}
                  >
                    {ACCOUNT_TYPE_DISPLAY_NAMES['stripe']}
                  </SelectItem>
                </SelectContent>
              </Select>

              {validationErrors.account_type?.map((error) => (
                <p key={error} className="mt-2 text-xs text-red-500">
                  {error}
                </p>
              ))}
            </div>

            <div>
              <CountryPicker
                onChange={onChangeCountry}
                value={country}
                allowedCountries={stripeConnectWhitelist}
              />
              <p className="dark:text-polar-500 mt-2 text-justify text-xs text-gray-500">
                If this is a personal account, please select your country of
                residence. If this is an organization or business, select the
                country of tax residency.
              </p>
              {validationErrors.country?.map((error) => (
                <p key={error} className="mt-2 text-xs text-red-500">
                  {error}
                </p>
              ))}
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-red-500">{errorMessage}</p>
          )}
          {validationErrors.__root__?.map((error) => (
            <p key={error} className="mt-2 text-xs text-red-500">
              {error}
            </p>
          ))}
          <Button
            className="self-start"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            Set up account
          </Button>
        </form>
      </div>
    </>
  )
}

export default AccountCreateModal
