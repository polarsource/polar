import { XMarkIcon } from '@heroicons/react/24/outline'
import { CONFIG } from 'polarkit'
import { OrganizationRead } from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import { useOrganizationCustomer, useUserOrganizations } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
import { useEffect, useState } from 'react'
import { useRequireAuth } from '../../hooks'

const SetupAccount = ({ onClose }: { onClose: () => void }) => {
  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  const [pledgeAs, setPledgeAs] = useState('')

  const onSelectOrg = (selected: string) => {
    setPledgeAs(selected)
  }

  const [selectedOrg, setSelectedOrg] = useState<OrganizationRead>()

  useEffect(() => {
    const org = userOrgQuery.data?.find((o) => o.name === pledgeAs)
    setSelectedOrg(org)
  }, [userOrgQuery, pledgeAs])

  const orgCustomer = useOrganizationCustomer(selectedOrg?.name)
  const customer = orgCustomer.data

  const MINIMUM_PLEDGE =
    typeof CONFIG.MINIMUM_PLEDGE_AMOUNT === 'string'
      ? parseInt(CONFIG.MINIMUM_PLEDGE_AMOUNT)
      : CONFIG.MINIMUM_PLEDGE_AMOUNT

  const [amount, setAmount] = useState(MINIMUM_PLEDGE)
  const [errorMessage, setErrorMessage] = useState<string | null>()

  const onAmountChange = (event) => {
    const amount = parseInt(event.target.value)
    if (isNaN(amount)) {
      setErrorMessage('Please enter a valid amount')
      setAmount(0)
      return
    }
    const amountInCents = amount * 100

    if (amountInCents < MINIMUM_PLEDGE) {
      setErrorMessage(
        `Minimum amount is ${getCentsInDollarString(MINIMUM_PLEDGE)}`,
      )
      setAmount(0)
      return
    }

    setErrorMessage(null)
    setAmount(amountInCents)
  }

  const [havePaymentMethod, setHavePaymentMethod] = useState(false)
  useEffect(() => {
    setHavePaymentMethod(
      customer?.default_payment_method?.card_last4 !== undefined,
    )
  }, [customer])

  const [isDone, setIsDone] = useState(false)
  const [loadingPledge, setLoadingPledge] = useState(false)

  return (
    <Background onClick={onClose}>
      <div
        className="h-full w-full p-8 md:h-min md:w-[800px] md:p-0"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="z-0 block flex h-full w-full flex-row overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex min-h-full flex-1 flex-col space-y-3 p-5 text-black/80">
            <div className="flex w-full items-start justify-between">
              <h1 className="text-2xl font-normal">Complete your backing</h1>
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
                  Country of residence or tax residence
                </label>
                <div className="flex flex-row items-center space-x-4">
                  <div className="relative w-40">
                    <input
                      type="text"
                      id="country"
                      name="country"
                      className="font-display block w-full rounded-lg border-gray-200 py-2 px-4 pl-8 pr-12 text-xl shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
                      onChange={onAmountChange}
                      onBlur={onAmountChange}
                    />
                  </div>
                  <p className="w-1/3 text-xs text-gray-500">
                    Minimum is ${getCentsInDollarString(MINIMUM_PLEDGE)}
                  </p>
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs text-red-500">{errorMessage}</p>
              )}
            </form>

            <div className="md:flex-1"></div>

            {!isDone && (
              <PrimaryButton
                onClick={() => {}}
                loading={loadingPledge}
                disabled={false}
              >
                Pledge ${getCentsInDollarString(amount)}
              </PrimaryButton>
            )}

            {isDone && (
              <span className="text-center text-lg">
                Thanks for pledging! 🎉
              </span>
            )}
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
