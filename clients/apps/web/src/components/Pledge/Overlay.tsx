import RepoSelection from '@/components/Dashboard/RepoSelection'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api, CONFIG } from 'polarkit'
import {
  IssueDashboardRead,
  OrganizationPrivateRead,
  OrganizationPublicRead,
  OrganizationStripeCustomerRead,
  PledgeMutationResponse,
  RepositoryRead,
} from 'polarkit/api/client'
import { IssueCard, RepositoryCard } from 'polarkit/components/pledge'
import { GreenBanner, PrimaryButton, RedBanner } from 'polarkit/components/ui'
import { useOrganizationCustomer, useUserOrganizations } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/utils'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useRequireAuth } from '../../hooks'

type PledgeSync = {
  amount: number
  pledgeAsOrg: OrganizationPrivateRead
}

const Overlay = ({
  onClose,
  issue,
  issueOrg,
  issueRepo,
}: {
  onClose: () => void
  issue: IssueDashboardRead
  issueOrg: OrganizationPublicRead
  issueRepo: RepositoryRead
}) => {
  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  const [pledge, setPledge] = useState<PledgeMutationResponse | undefined>(
    undefined,
  )

  const shouldSynchronizePledge = (pledgeSync: PledgeSync) => {
    if (pledgeSync.amount < MINIMUM_PLEDGE) {
      return false
    }

    // Sync if pledge is missing
    if (!pledge) {
      return true
    }

    // Sync if amount has chagned
    if (pledge && pledge.amount !== pledgeSync.amount) {
      return true
    }

    return false
  }

  const createPledge = (pledgeSync: PledgeSync) =>
    api.pledges.createPledge({
      platform: issue.platform,
      orgName: issueOrg.name,
      repoName: issueRepo.name,
      number: issue.number,
      requestBody: {
        issue_id: issue.id,
        amount: pledgeSync.amount,
        pledge_as_org: pledgeSync.pledgeAsOrg?.id,
      },
    })

  const updatePledge = async (
    pledgeSync: PledgeSync,
  ): Promise<PledgeMutationResponse> => {
    if (!pledge) {
      throw Error('no pledge to update')
    }
    return await api.pledges.updatePledge({
      platform: issue.platform,
      orgName: issueOrg.name,
      repoName: issueRepo.name,
      number: issue.number,
      pledgeId: pledge.id,
      requestBody: {
        amount: pledgeSync.amount,
        pledge_as_org: pledgeSync.pledgeAsOrg?.id,
      },
    })
  }

  const synchronizePledge = async (pledgeSync: PledgeSync) => {
    if (!pledgeSync.pledgeAsOrg) {
      return
    }

    if (!shouldSynchronizePledge(pledgeSync)) {
      return
    }

    setSyncing(true)
    let updatedPledge: PledgeMutationResponse
    if (!pledge) {
      updatedPledge = await createPledge(pledgeSync)
    } else {
      updatedPledge = await updatePledge(pledgeSync)
    }

    if (updatedPledge) {
      setPledge(updatedPledge)
    }
    setSyncing(false)
  }

  const syncTimeout = useRef<ReturnType<typeof setTimeout>>()
  const debouncedSync = (pledgeSync: PledgeSync) => {
    clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => synchronizePledge(pledgeSync), 500)
  }

  const onSelectOrg = (selected: string) => {
    const org = userOrgQuery.data?.find((o) => o.name === selected)
    if (!org) {
      return
    }
    setSelectedOrg(org)
    debouncedSync({ amount, pledgeAsOrg: org })
  }

  const [selectedOrg, setSelectedOrg] = useState<OrganizationPrivateRead>()

  const orgCustomer = useOrganizationCustomer(selectedOrg?.name)
  const customer = orgCustomer.data

  const MINIMUM_PLEDGE =
    typeof CONFIG.MINIMUM_PLEDGE_AMOUNT === 'string'
      ? parseInt(CONFIG.MINIMUM_PLEDGE_AMOUNT)
      : CONFIG.MINIMUM_PLEDGE_AMOUNT

  const [amount, setAmount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [isSyncing, setSyncing] = useState(false)

  const onAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = parseInt(event.target.value)
    if (isNaN(amount)) {
      setErrorMessage('Please enter a valid amount')
      return
    }
    const amountInCents = amount * 100

    if (amountInCents < MINIMUM_PLEDGE) {
      setErrorMessage(
        `Minimum amount is $${getCentsInDollarString(MINIMUM_PLEDGE)}`,
      )
      return
    }

    setErrorMessage(undefined)
    setAmount(amountInCents)

    if (!selectedOrg) {
      return
    }

    debouncedSync({ amount: amountInCents, pledgeAsOrg: selectedOrg })
  }

  const [havePaymentMethod, setHavePaymentMethod] = useState(false)
  useEffect(() => {
    setHavePaymentMethod(
      customer?.default_payment_method?.card_last4 !== undefined,
    )
  }, [customer])

  const [isDone, setIsDone] = useState(false)

  const payPledge = async () => {
    if (!pledge) {
      throw Error('no pledge')
    }
    return await api.pledges.confirmPledge({
      platform: issue.platform,
      orgName: issueOrg.name,
      repoName: issueRepo.name,
      number: issue.number,
      pledgeId: pledge.id,
    })
  }

  const onClickPledge = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    await payPledge()
    setIsDone(true)
  }

  return (
    <Background onClick={onClose}>
      <div
        className="h-full w-full p-8 md:h-min md:w-[800px] md:p-0"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="z-0 block flex h-full w-full flex-row overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="bg-gray-75 hidden flex-1 border-r border-gray-200/50 p-5 md:block">
            <div>
              <IssueCard
                issue={issue}
                className="border-0 bg-white shadow"
                organization={issueOrg}
                repository={issueRepo}
              />
            </div>
            <RepositoryCard organization={issueOrg} repository={issueRepo} />
          </div>

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
                  htmlFor="pledge-as"
                  className="text-sm font-medium text-gray-600"
                >
                  Pledge as
                </label>
                <div className="flex flex-row items-center space-x-4">
                  <div className="relative w-full rounded-lg border border-gray-200">
                    <RepoSelection
                      onSelectOrg={onSelectOrg}
                      currentOrg={selectedOrg}
                      fullWidth={true}
                    />
                  </div>
                </div>
              </div>

              {customer && (
                <div>
                  <PaymentMethod customer={customer} />
                </div>
              )}
              <div className="space-y-2">
                <label
                  htmlFor="amount"
                  className="text-sm font-medium text-gray-600"
                >
                  Choose amount to pledge
                </label>
                <div className="flex flex-row items-center space-x-4">
                  <div className="relative w-40">
                    <input
                      type="number"
                      id="amount"
                      name="amount"
                      className="font-display block w-full rounded-lg border-gray-200 py-2 px-4 pl-8 pr-12 text-xl shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
                      onChange={onAmountChange}
                      onBlur={onAmountChange}
                      placeholder={getCentsInDollarString(MINIMUM_PLEDGE)}
                    />
                    <div className="font-display pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-xl">
                      <span className="text-gray-500">$</span>
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <span className="text-xs text-gray-500">USD</span>
                    </div>
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

            {pledge && (
              <>
                <div className="mt-6 flex w-full">
                  <div className="w-full">Pledge</div>
                  <div className="w-full text-right">
                    ${getCentsInDollarString(pledge.amount, true)}
                  </div>
                </div>
                <div className="flex w-full">
                  <div className="w-full">Service fee</div>
                  <div className="w-full text-right">
                    ${getCentsInDollarString(pledge.fee, true)}
                  </div>
                </div>
                <div className="mb-6 flex w-full">
                  <div className="w-full">Total</div>
                  <div className="w-full text-right">
                    ${getCentsInDollarString(pledge.amount_including_fee, true)}
                  </div>
                </div>
              </>
            )}

            {!isDone && (
              <PrimaryButton
                onClick={onClickPledge}
                loading={isSyncing}
                disabled={!havePaymentMethod || !pledge || isSyncing}
              >
                Pay $
                {getCentsInDollarString(
                  pledge ? pledge.amount_including_fee : MINIMUM_PLEDGE,
                )}
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
        <span>Organization doesn&apos;t have any saved payment methods.</span>
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
