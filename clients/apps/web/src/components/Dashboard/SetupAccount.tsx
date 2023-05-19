import Modal, { ModalBox } from '@/components/Shared/Modal'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from 'polarkit'
import { AccountType, ApiError, Platforms } from 'polarkit/api/client'
import { CountryPicker } from 'polarkit/components'
import { PrimaryButton } from 'polarkit/components/ui'
import { useStore } from 'polarkit/store'
import { useState } from 'react'

const SetupAccount = ({ onClose }: { onClose: () => void }) => {
  const currentOrg = useStore((store) => store.currentOrg)

  const [country, setCountry] = useState<string>('US')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const [loadingStripe, setLoadingStripe] = useState(false)

  const onChangeCountry = (countryCode: string) => {
    setErrorMessage(undefined)
    setCountry(countryCode)
  }

  const onConfirm = async () => {
    setLoadingStripe(true)

    if (!currentOrg) {
      throw Error('no org set')
    }

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
    <Modal onClose={onClose}>
      <ModalBox>
        <>
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
        </>
      </ModalBox>
    </Modal>
  )
}

export default SetupAccount
