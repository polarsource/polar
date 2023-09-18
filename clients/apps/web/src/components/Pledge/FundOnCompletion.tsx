import { useAuth } from '@/hooks/auth'
import {
  BellIcon,
  EnvelopeIcon,
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
import { validateEmail } from './payment'

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

  const hasValidDetails =
    validateEmail(email) &&
    amount >= issue.repository.organization.pledge_minimum_amount

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
    <div className="flex flex-col">
      {!currentUser && <NotLoggedInBanner />}

      <label
        htmlFor="amount"
        className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400"
      >
        Funding amount
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

      <label
        htmlFor="email"
        className="mb-2 mt-4 text-sm font-medium text-gray-500 dark:text-gray-400"
      >
        Contact details
      </label>
      <div className="relative">
        <input
          type="email"
          id="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          className="block w-full rounded-lg border-gray-200 bg-transparent px-3 py-2.5 pl-10 text-sm shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
          onFocus={(event) => {
            event.target.select()
          }}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-3 text-lg">
          <span className="text-gray-500">
            <EnvelopeIcon className="h-6 w-6" />
          </span>
        </div>
      </div>

      <div className="mt-6">
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
    <div className="mb-4 flex flex-col gap-4 rounded-lg border border-red-200 px-4 py-3 dark:border-red-700">
      <div className="flex items-center justify-between">
        <div className="text-lg font-medium text-gray-700 dark:text-gray-400">
          Sign in with GitHub
        </div>
        <div className="rounded-sm border border-red-200 bg-red-50 px-2 text-red-500 dark:border-red-700 dark:bg-red-900">
          Required
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <UserCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <div className="text-gray-600 dark:text-gray-500">
            Show profile in connection with funding
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BellIcon className="h-5 w-5 text-gray-500" />
          <div className="text-sm text-gray-600 dark:text-gray-500">
            + Track funding on progress
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LogoIcon className="h-5 w-5" />
          <div className="text-sm text-gray-600 dark:text-gray-500">
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
