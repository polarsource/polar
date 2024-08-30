import { ACCOUNT_TYPE_DISPLAY_NAMES } from '@/utils/account'
import { api } from '@/utils/api'
import { getValidationErrorsMap } from '@/utils/api/errors'
import {
  Account,
  AccountType,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import CountryPicker from 'polarkit/components/ui/atoms/countrypicker'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import { ChangeEvent, useState } from 'react'

const AccountCreateModal = ({
  onClose,
  forOrganizationId,
  forUserId,
  accountTypes,
  returnPath,
}: {
  onClose: () => void
  forOrganizationId?: string
  forUserId?: string
  accountTypes: AccountType[]
  returnPath: string
}) => {
  const [accountType, setAccountType] = useState<AccountType>(
    AccountType.STRIPE,
  )
  const [openCollectiveSlug, setOpenCollectiveSlug] = useState<string | null>(
    null,
  )
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
    setAccountType(value as AccountType)
  }

  const onChangeOpenCollectiveSlug = (e: ChangeEvent<HTMLInputElement>) => {
    resetErrors()
    setOpenCollectiveSlug(e.target.value)
  }

  const onChangeCountry = (countryCode: string) => {
    resetErrors()
    setCountry(countryCode)
  }

  const onConfirm = async () => {
    setLoading(true)

    try {
      const account = await api.accounts.create({
        body: {
          account_type: accountType,
          country,
          ...(openCollectiveSlug
            ? { open_collective_slug: openCollectiveSlug }
            : {}),
        },
      })
      if (forOrganizationId) {
        await api.organizations.setAccount({
          id: forOrganizationId,
          body: { account_id: account.id },
        })
      }
      if (forUserId) {
        await api.users.setAccount({
          body: { account_id: account.id },
        })
      }

      await goToOnboarding(account)
    } catch (e) {
      if (e instanceof ResponseError) {
        const body = await e.response.json()
        if (e.response.status === 422) {
          const validationErrors = body['detail'] as ValidationError[]
          setValidationErrors(getValidationErrorsMap(validationErrors))
        } else if (body['detail']) {
          setErrorMessage(body['detail'])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const goToOnboarding = async (account: Account) => {
    setLoading(true)

    try {
      const link = await api.accounts.onboardingLink({
        id: account.id,
        returnPath,
      })
      window.location.href = link.url
    } catch (e) {
      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-y-6 overflow-auto p-8">
        <h2>Create payout account</h2>
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
                  {accountTypes.map((v: AccountType) => (
                    <SelectItem
                      key={v}
                      onClick={() => setAccountType(v)}
                      value={v}
                    >
                      {ACCOUNT_TYPE_DISPLAY_NAMES[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {validationErrors.account_type?.map((error) => (
                <p key={error} className="mt-2 text-xs text-red-500">
                  {error}
                </p>
              ))}
            </div>

            {accountType === AccountType.OPEN_COLLECTIVE && (
              <div>
                <div className="relative mt-2 flex flex-col gap-y-2">
                  <label htmlFor="open_collective_slug" className="text-sm">
                    Open Collective Slug
                  </label>
                  <Input
                    type="text"
                    id="open_collective_slug"
                    name="open_collective_slug"
                    value={openCollectiveSlug || ''}
                    onChange={onChangeOpenCollectiveSlug}
                    required
                  />
                </div>
                {validationErrors.open_collective_slug?.map((error) => (
                  <p key={error} className="mt-2 text-xs text-red-500">
                    {error}
                  </p>
                ))}
              </div>
            )}

            <div>
              <CountryPicker onSelectCountry={onChangeCountry} />
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
