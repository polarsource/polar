import Modal, { ModalBox } from '@/components/Shared/Modal'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from 'polarkit'
import { AccountRead, AccountType, ApiError, Platforms } from 'polarkit/api/client'
import { getValidationErrorsMap, isValidationError } from 'polarkit/api/errors'
import { CountryPicker } from 'polarkit/components'
import { PrimaryButton } from 'polarkit/components/ui'
import { useStore } from 'polarkit/store'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_DISPLAY_NAMES } from 'polarkit/account'
import { ChangeEvent, useState } from 'react'
import { useRouter } from 'next/router'

const SetupAccount = ({ onClose }: { onClose: () => void }) => {
  const router = useRouter();

  const currentOrg = useStore((store) => store.currentOrg)

  const [accountType, setAccountType] = useState<AccountType>(AccountType.STRIPE)
  const [openCollectiveSlug, setOpenCollectiveSlug] = useState<string | null>(null)
  const [country, setCountry] = useState<string>('US')
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({})
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const [loading, setLoading] = useState(false)

  const resetErrors = () => {
    setErrorMessage(undefined)
    setValidationErrors({})
  }

  const onChangeAccountType = (e: ChangeEvent<HTMLSelectElement>) => {
    resetErrors()
    setAccountType(e.target.value as AccountType)
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

    if (!currentOrg) {
      throw Error('no org set')
    }

    try {
      const account = await api.accounts.createAccount({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        requestBody: {
          account_type: accountType,
          country,
          ...openCollectiveSlug ? {open_collective_slug: openCollectiveSlug } : {},
        },
      })

      await goToOnboarding(account)

    } catch (e) {
      if (e instanceof ApiError) {
        if (isValidationError(e)) {
          setValidationErrors(getValidationErrorsMap(e.body.detail))
        } else {
          setErrorMessage(e.body.detail)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const goToOnboarding = async (account: AccountRead) => {
    if (!currentOrg) {
      throw Error('no org set')
    }

    setLoading(true)

    try {
      const link = await api.accounts.onboardingLink({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        accountId: account.id,
      })
      window.location.href = link.url
    } catch (e) {
      router.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <ModalBox>
        <>
          <div className="flex w-full items-start justify-between">
            <h1 className="text-2xl font-normal">Receive payments</h1>
            <XMarkIcon
              className="h-6 w-6 cursor-pointer hover:text-gray-500 dark:hover:text-gray-400"
              onClick={onClose}
            />
          </div>

          <form className="z-0 flex flex-col space-y-4">
            <div className="space-y-4">
              <div>
                <select
                  id="account_type"
                  name="account_type"
                  onChange={onChangeAccountType}
                  className="font-display block w-full rounded-lg border-gray-200 bg-transparent py-2 px-4 pr-12 shadow-sm transition-colors focus:z-10 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-500"
                >
                  {ACCOUNT_TYPES.map((v: AccountType) =>
                    <option
                      key={v}
                      value={v}
                      selected={v === accountType}
                    >
                      {ACCOUNT_TYPE_DISPLAY_NAMES[v]}
                    </option>
                  )} 
                </select>
                {validationErrors.account_type?.map((error) => <p key={error} className="text-xs text-red-500 mt-2">{error}</p>)}
              </div>

              {accountType === AccountType.OPEN_COLLECTIVE &&
                <div>
                  <div className="relative mt-2">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="font-display text-gray-500 dark:text-gray-40">https://opencollective.com/</span>
                    </div>
                    <input 
                      type="text"
                      id="open_collective_slug"
                      name="open_collective_slug"
                      className="pl-60 font-display block w-full rounded-lg border-gray-200 bg-transparent py-2 shadow-sm transition-colors focus:z-10 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-500"
                      value={openCollectiveSlug || ''}
                      onChange={onChangeOpenCollectiveSlug}
                      required
                    />
                  </div>
                  {validationErrors.open_collective_slug?.map((error) => <p key={error} className="text-xs text-red-500 mt-2">{error}</p>)}
                </div>
              }

              <div>
                <CountryPicker onSelectCountry={onChangeCountry} />
                <p
                  className="text-xs font-medium text-gray-500 dark:text-gray-40 text-justify mt-2"
                >
                  If this is a personal account, please select your country of
                  residence. If this is an organization or business, select the
                  country of tax residency.
                </p>
                {validationErrors.country?.map((error) => <p key={error} className="text-xs text-red-500 mt-2">{error}</p>)}
              </div>
            </div>

            {errorMessage && (
              <p className="text-xs text-red-500">{errorMessage}</p>
            )}
            {validationErrors.__root__?.map((error) => <p key={error} className="text-xs text-red-500 mt-2">{error}</p>)}
          </form>

          <div className="md:flex-1"></div>

          <PrimaryButton
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            Set up account
          </PrimaryButton>
        </>
      </ModalBox>
    </Modal>
  )
}

export default SetupAccount
