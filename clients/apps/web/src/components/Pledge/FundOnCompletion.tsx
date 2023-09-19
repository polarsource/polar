import { useAuth } from '@/hooks/auth'
import {
  BellIcon,
  ClockIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import { Issue } from 'polarkit/api/client'
import { LogoIcon } from 'polarkit/components/brand'
import { MoneyInput, PrimaryButton } from 'polarkit/components/ui'
import { getCentsInDollarString } from 'polarkit/money'
import { classNames } from 'polarkit/utils'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import GithubLoginButton from '../Shared/GithubLoginButton'
import { Checkbox } from '../ui/checkbox'

const FundOnCompletion = ({
  issue,
  gotoURL,
}: {
  issue: Issue
  gotoURL?: string
}) => {
  const organization = issue.repository.organization
  const [amount, setAmount] = useState<number>(
    issue.repository.organization.pledge_minimum_amount,
  )
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const { currentUser } = useAuth()

  const router = useRouter()

  const onAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    let newAmount = parseInt(event.target.value)
    if (isNaN(newAmount)) {
      newAmount = 0
    }
    const amountInCents = newAmount * 100
    setAmount(amountInCents)
  }

  const didFirstUserEmailSync = useRef(false)
  useEffect(() => {
    if (currentUser && currentUser.email && !didFirstUserEmailSync.current) {
      didFirstUserEmailSync.current = true
      setEmail(currentUser.email)
    }
  }, [currentUser])

  const [isLoading, setIsLoading] = useState(false)

  const [paymentPromise, setPaymentPromise] = useState(false)

  const hasValidDetails =
    amount >= issue.repository.organization.pledge_minimum_amount &&
    !!currentUser &&
    paymentPromise

  const submit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    setIsLoading(true)
    setErrorMessage('')
    try {
      await api.pledges.createPayOnCompletion({
        requestBody: {
          issue_id: issue.id,
          amount: amount,
        },
      })

      router.push('/feed')
    } catch (e) {
      setErrorMessage('Something went wrong, please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!currentUser && <NotLoggedInBanner />}

      <div>
        <label
          htmlFor="amount"
          className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400"
        >
          Amount
        </label>
        <div className="flex flex-row items-center space-x-4">
          <MoneyInput
            id="amount"
            name="amount"
            onChange={onAmountChange}
            placeholder={organization.pledge_minimum_amount}
            value={amount}
            onFocus={(event) => {
              event.target.select()
            }}
          />
          <p
            className={classNames(
              amount < organization.pledge_minimum_amount ? 'text-red-500' : '',
              'w-2/5 text-xs text-gray-500 dark:text-gray-400',
            )}
          >
            Minimum is $
            {getCentsInDollarString(organization.pledge_minimum_amount)}
          </p>
        </div>
      </div>

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
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            I promise to pay once the issue is completed
          </label>
          <p className="text-muted-foreground text-xs">
            Unless I have a legitimate dispute
          </p>
        </div>
      </div>

      <div className="">
        <PrimaryButton
          disabled={!hasValidDetails}
          loading={isLoading}
          onClick={submit}
        >
          Fund this issue
        </PrimaryButton>
      </div>

      {errorMessage && (
        <div className="mt-3.5 text-red-500 dark:text-red-400">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

export default FundOnCompletion

const NotLoggedInBanner = () => {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-red-200 px-4 py-4 dark:border-red-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div className="text-base font-medium text-gray-700 dark:text-gray-400">
          Sign in with GitHub
        </div>
        <div className="rounded-sm border border-red-200 bg-red-50 px-1 text-xs text-red-500 dark:border-red-700 dark:bg-red-900">
          Required
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <UserCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-500">
            Show profile in connection with funding
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BellIcon className="h-5 w-5 text-gray-500" />
          <div className="text-xs text-gray-600 dark:text-gray-500">
            + Track funding on funded issue
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LogoIcon className="h-5 w-5" />
          <div className="text-xs text-gray-600 dark:text-gray-500">
            + Polar account for future funding & rewards
          </div>
        </div>
      </div>
      <GithubLoginButton
        size="large"
        text="Continue with GitHub"
        fullWidth={true}
      />
    </div>
  )
}

const NextSteps = () => (
  <div className="flex flex-col gap-3 text-sm text-gray-600  dark:text-gray-400 ">
    <div className="flex items-center gap-4 font-medium ">
      <ClockIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
      <div>
        <div className="text-gray-600 dark:text-gray-300">
          Fund on completion
        </div>
        <div className="text-xs font-light text-gray-500 dark:text-gray-400">
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
  <div className="m-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-around rounded-full border border-gray-200 dark:border-gray-500">
    <span className="text-sm">{children}</span>
  </div>
)
