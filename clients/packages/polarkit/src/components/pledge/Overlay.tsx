import { XMarkIcon } from '@heroicons/react/24/outline'
import { RepoSelection } from 'polarkit/components'
import {
  requireAuth,
  useOrganizationCustomer,
  useUserOrganizations,
} from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
import { useEffect, useState } from 'react'
import { api, CONFIG } from '../../../index'
import {
  IssueRead,
  OrganizationRead,
  OrganizationStripeCustomerRead,
  RepositoryRead,
} from '../../api/client/index'
import { GreenBanner, PrimaryButton, RedBanner } from '../ui'
import IssueCard from './IssueCard'
import RepositoryCard from './RepositoryCard'

const Overlay = ({
  onClose,
  issue,
  issueOrg,
  issueRepo,
}: {
  onClose: () => void
  issue: IssueRead
  issueOrg: OrganizationRead
  issueRepo: RepositoryRead
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

  const [isDone, setIsDone] = useState(false)
  const [loadingPledge, setLoadingPledge] = useState(false)

  const createPledge = async () => {
    if (!selectedOrg) {
      return
    }

    setLoadingPledge(true)

    await api.pledges.createPledge({
      platform: issue.platform,
      orgName: issueOrg.name,
      repoName: issueRepo.name,
      number: issue.number,
      requestBody: {
        issue_id: issue.id,
        amount: amount,
        pledge_as_org: selectedOrg.id,
      },
    })

    setLoadingPledge(false)
    setIsDone(true)
  }

  const onClickPledge = async (e) => {
    e.preventDefault()
    await createPledge()
  }

  return (
    <Background onClick={onClose}>
      <div className="h-full w-full p-8 md:h-min md:w-[800px] md:p-0">
        <div className="z-0 block flex h-full w-full flex-row rounded-md bg-white">
          <div className="hidden flex-1 bg-black/10 p-4 md:block">
            <div>
              <IssueCard issue={issue} bg="bg-white" />
            </div>
            <RepositoryCard organization={issueOrg} repository={issueRepo} />
          </div>

          <div className="flex min-h-full flex-1 flex-col space-y-3 p-4 text-black/80">
            <div className="flex w-full items-start justify-between">
              <h1 className="text-xl font-normal">Complete your backing</h1>
              <XMarkIcon
                className="h-6 w-6 cursor-pointer text-black/50 hover:text-black"
                onClick={onClose}
              />
            </div>

            <form className="z-0 flex flex-col space-y-3">
              <label
                htmlFor="pledge-as"
                className="text-sm font-medium text-gray-600"
              >
                Pledge as
              </label>
              <div className="flex flex-row items-center space-x-4">
                <div className="relative w-full">
                  <RepoSelection
                    onSelectOrg={onSelectOrg}
                    currentOrg={selectedOrg}
                    fullWidth={true}
                  />
                </div>
              </div>

              {customer && (
                <div>
                  <PaymentMethod customer={customer} />
                </div>
              )}

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
                  <div className="pointer-events-none absolute inset-y-0 left-0  flex items-center pl-4">
                    <span className="text-gray-500">$</span>
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <span className="text-gray-500">USD</span>
                  </div>
                </div>
                <p className="w-1/3 text-xs text-gray-500">
                  Minimum is ${getCentsInDollarString(MINIMUM_PLEDGE)}
                </p>
              </div>

              {errorMessage && (
                <p className="text-xs text-red-500">{errorMessage}</p>
              )}
            </form>

            <div className="md:flex-1"></div>

            {!isDone && (
              <PrimaryButton
                onClick={onClickPledge}
                loading={loadingPledge}
                disabled={!havePaymentMethod || !amount}
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
