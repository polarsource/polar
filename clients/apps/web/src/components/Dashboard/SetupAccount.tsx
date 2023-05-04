import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from 'polarkit'
import {
  AccountType,
  ApiError,
  OrganizationRead,
  Platforms,
} from 'polarkit/api/client'
import { CountryPicker } from 'polarkit/components'
import { PrimaryButton } from 'polarkit/components/ui'
import { useStore } from 'polarkit/store'
import { useState } from 'react'

const SetupAccount = ({ onClose }: { onClose: () => void }) => {
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRead>()

  const currentOrg = useStore((store) => store.currentOrg)

  const [country, setCountry] = useState<string>('US')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const [loadingStripe, setLoadingStripe] = useState(false)

  const onChangeCountry = (countryCode) => {
    setErrorMessage(undefined)
    setCountry(countryCode)
  }

  const onConfirm = async () => {
    setLoadingStripe(true)

    try {
      const account = await api.accounts.createAccount({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        requestBody: { account_type: AccountType.STRIPE, country },
      })

      const link = await api.accounts.onboardingLink({
        platform: Platforms.GITHUB,
        orgName: currentOrg.name,
        stripeId: account.stripe_id,
      })

      window.location.href = link.url
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMessage(e.body.detail)
      }
    }

    setLoadingStripe(false)
  }

  return (
    <Background onClick={onClose}>
      <div
        className="h-full w-full p-8 md:h-min md:w-[400px] md:p-0"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="z-0 block flex h-full w-full flex-row overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex min-h-full flex-1 flex-col space-y-3 p-5 text-black/80">
            <div className="flex w-full items-start justify-between">
              <h1 className="text-2xl font-normal">Receive payments</h1>
              <XMarkIcon
                className="h-6 w-6 cursor-pointer text-black/50 hover:text-black"
                onClick={onClose}
              />
            </div>

            <form className="z-0 flex flex-col space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="country"
                  className="text-sm font-medium text-gray-600"
                >
                  If this is a personal account, please select your country of
                  residence. If this is an organization or business, select the
                  country of tax residency.
                </label>
                <div className="space-x-4">
                  <CountryPicker onSelectCountry={onChangeCountry} />
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs text-red-500">{errorMessage}</p>
              )}
            </form>

            <div className="md:flex-1"></div>

            <PrimaryButton
              onClick={onConfirm}
              loading={loadingStripe}
              disabled={loadingStripe}
            >
              Set up account
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Background>
  )
}

const Background = ({
  children,
  onClick,
}: {
  children: React.ReactElement
  onClick: () => void
}) => {
  return (
    <div
      onClick={onClick}
      className="fixed bottom-0 left-0 right-0 top-0 z-10 flex items-center justify-center bg-black/50"
    >
      {children}
    </div>
  )
}

export default SetupAccount
