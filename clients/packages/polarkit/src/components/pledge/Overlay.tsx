import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  IssueRead,
  OrganizationRead,
  OrganizationStripeCustomerRead,
} from 'api/client/index'
import { RepoSelection } from 'polarkit/components'
import {
  requireAuth,
  useOrganizationCustomer,
  useUserOrganizations,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
import { useEffect, useState } from 'react'
import { CONFIG } from '../../../index'
import { GreenBanner, PrimaryButton, RedBanner } from '../ui'

const Overlay = ({
  onClose,
  issue,
}: {
  onClose: () => void
  issue: IssueRead
}) => {
  const { currentUser } = requireAuth()
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

  return (
    <Background>
      <div className="z-0 h-1/2 w-1/2 rounded-md bg-white p-4">
        <div className="flex w-full items-start justify-between">
          <h1 className="font-md text-xl">Add a pledge to #{issue.number}</h1>
          <XMarkIcon
            className="h-6 w-6 cursor-pointer text-black/50 hover:text-black"
            onClick={onClose}
          />
        </div>
        <p>{issue.title}</p>
        <div className="flex items-center">
          <span>Pledge as</span>
          <RepoSelection onSelectOrg={onSelectOrg} currentOrg={selectedOrg} />
        </div>

        {customer && (
          <div>
            <PaymentMethod customer={customer} />
          </div>
        )}

        {havePaymentMethod && (
          <form className="z-0 flex flex-col space-y-3">
            <label
              htmlFor="amount"
              className="text-sm font-medium text-gray-600"
            >
              Choose amount to pledge
            </label>
            <div className="flex flex-row items-center space-x-4">
              <div className="relative w-2/3">
                <input
                  type="text"
                  id="amount"
                  name="amount"
                  className="block w-full rounded-md border-gray-200 py-3 px-4 pl-9 pr-16 text-sm shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
                  onChange={onAmountChange}
                  onBlur={onAmountChange}
                  placeholder={getCentsInDollarString(MINIMUM_PLEDGE)}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4">
                  <span className="text-gray-500">$</span>
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center pr-4">
                  <span className="text-gray-500">USD</span>
                </div>
              </div>
              <p className="w-1/3 text-xs text-gray-500">
                Minimum is ${getCentsInDollarString(MINIMUM_PLEDGE)}
              </p>
            </div>

            {errorMessage}

            {amount && (
              <PrimaryButton onClick={() => alert('click')}>
                Pledge ${getCentsInDollarString(amount)}
              </PrimaryButton>
            )}
          </form>
        )}
      </div>
    </Background>
  )
}

const Background = ({ children }: { children: React.ReactElement }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 top-0 z-10 flex items-center justify-center bg-black/20">
      {children}
    </div>
  )
}

const PaymentMethod = ({
  customer,
}: {
  customer: OrganizationStripeCustomerRead
}) => {
  if (!customer) {
    return (
      <RedBanner>
        <span>No customer</span>
      </RedBanner>
    )
  }
  if (!customer.default_payment_method) {
    return (
      <RedBanner>
        <span>Organization doesn't have any saved payment methods.</span>
      </RedBanner>
    )
  }
  return (
    <GreenBanner>
      <>
        Using saved credit card ending with{' '}
        <span className="font-mono">
          {customer.default_payment_method.card_last4}
        </span>
      </>
    </GreenBanner>
  )
}

export default Overlay
