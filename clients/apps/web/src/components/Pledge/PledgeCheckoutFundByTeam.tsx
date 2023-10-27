import { useAuth } from '@/hooks/auth'
import { ClockIcon } from '@heroicons/react/24/outline'
import { Issue, Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import { Button, MoneyInput } from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { getCentsInDollarString } from 'polarkit/money'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TeamSelect from './TeamSelect'

const PledgeCheckoutFundByTeam = ({
  issue,
  gotoURL,
}: {
  issue: Issue
  gotoURL?: string
}) => {
  const organization = issue.repository.organization

  const [formState, setFormState] = useState<{
    amount: number
    by_organization_id: string | undefined
  }>({
    amount: issue.repository.organization.pledge_minimum_amount,
    by_organization_id: undefined,
  })

  const [errorMessage, setErrorMessage] = useState<string>('')

  const { currentUser } = useAuth()

  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)

  const [paymentPromise, setPaymentPromise] = useState(false)

  const [selectedOrg, setSelectedOrg] = useState<Organization | undefined>(
    undefined,
  )

  const hasValidDetails =
    formState.amount >= issue.repository.organization.pledge_minimum_amount &&
    !!currentUser &&
    paymentPromise &&
    formState.by_organization_id &&
    selectedOrg

  const submit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (!hasValidDetails) {
      setErrorMessage('Invalid details')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    try {
      await api.pledges.createPayOnCompletion({
        createPledgePayLater: {
          issue_id: issue.id,
          amount: formState.amount,
          by_organization_id: formState.by_organization_id,
        },
      })

      router.push(`/team/${selectedOrg.name}/funding`)
    } catch (e) {
      setErrorMessage('Something went wrong, please try again.')
      setIsLoading(false)
    }
  }

  const onAmountChange = (amount: number) => {
    setFormState({
      ...formState,
      amount,
    })
  }

  const onChangeOnBehalfOf = (org: Organization | undefined) => {
    setFormState({
      ...formState,
      by_organization_id: org ? org.id : undefined,
    })
    setSelectedOrg(org)
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div>
        <label
          htmlFor="amount"
          className="dark:text-polar-400 mb-2 text-sm font-medium text-gray-500"
        >
          Amount
        </label>
        <div className="mt-2 flex flex-row items-center space-x-4">
          <MoneyInput
            id="amount"
            name="amount"
            onAmountChangeInCents={onAmountChange}
            placeholder={organization.pledge_minimum_amount}
            value={formState.amount}
            onFocus={(event) => {
              event.target.select()
            }}
          />
          <p
            className={twMerge(
              formState.amount < organization.pledge_minimum_amount
                ? 'text-red-500'
                : '',
              'dark:text-polar-400 text-xs text-gray-500',
            )}
          >
            Minimum is $
            {getCentsInDollarString(organization.pledge_minimum_amount)}
          </p>
        </div>
      </div>

      <TeamSelect
        onChange={onChangeOnBehalfOf}
        allowSelfSelect={false}
        title="Team"
        defaultToFirstOrganization={true}
      />

      <NextSteps />

      <hr />

      <div className="items-top flex items-center space-x-2">
        <Checkbox
          id="payment_promise"
          onCheckedChange={(e) => setPaymentPromise(Boolean(e))}
        />
        <div className="grid gap-0 leading-none">
          <label
            htmlFor="payment_promise"
            className="dark:text-polar-400 text-xs font-medium text-gray-500"
          >
            I promise to pay once the issue is completed
          </label>
          <p className="text-muted-foreground text-xs">
            Unless I have a legitimate dispute
          </p>
        </div>
      </div>

      <div className="">
        <Button
          fullWidth
          size="lg"
          disabled={!hasValidDetails}
          loading={isLoading}
          onClick={submit}
        >
          Fund this issue
        </Button>
      </div>

      {errorMessage && (
        <div className="mt-3.5 text-red-500 dark:text-red-400">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

export default PledgeCheckoutFundByTeam

const NextSteps = () => (
  <div className="dark:text-polar-400 flex flex-col gap-3 text-sm  text-gray-600 ">
    <div className="flex items-center gap-4 font-medium ">
      <ClockIcon className="dark:text-polar-400 h-6 w-6 text-gray-600" />
      <div>
        <div className="dark:text-polar-300 text-gray-600">
          Fund on completion
        </div>
        <div className="dark:text-polar-400 text-xs font-light text-gray-500">
          Payment terms and how it works
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <CircledNumber>1</CircledNumber>
      <div>Pledge amount today</div>
    </div>
    <div className="flex items-center gap-4">
      <CircledNumber>2</CircledNumber>
      <div>Get progress updates</div>
    </div>
    <div className="flex items-center gap-4">
      <CircledNumber>3</CircledNumber>
      <div>Receive invoice once issue is completed</div>
    </div>
    <div className="flex items-center gap-4">
      <CircledNumber>4</CircledNumber>
      <div>Pay invoice within 7 days</div>
    </div>
  </div>
)

export const CircledNumber = ({ children }: { children: React.ReactNode }) => (
  <div className="dark:border-polar-500 m-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-around rounded-full border border-gray-200">
    <span className="text-sm">{children}</span>
  </div>
)
