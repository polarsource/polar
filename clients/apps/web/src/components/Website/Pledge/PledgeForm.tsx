import { Elements } from '@stripe/react-stripe-js'
import { PaymentIntent } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { CONFIG } from 'polarkit'
import { api } from 'polarkit/api'
import {
  IssueRead,
  OrganizationPublicRead,
  PledgeMutationResponse,
  RepositoryRead,
} from 'polarkit/api/client'
import { Checkbox, PrimaryButton } from 'polarkit/components/ui'
import { getCentsInDollarString } from 'polarkit/utils'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../hooks/auth'
import PaymentForm, { generateRedirectURL } from './PaymentForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

type PledgeSync = {
  amount: number
  email: string
  approvedTos: boolean
}

const PledgeForm = ({
  organization,
  repository,
  issue,
}: {
  issue: IssueRead
  organization: OrganizationPublicRead
  repository: RepositoryRead
}) => {
  const [pledge, setPledge] = useState<PledgeMutationResponse | null>(null)
  const [amount, setAmount] = useState(0)
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isSyncing, setSyncing] = useState(false)
  const [approvedTos, setApprovedTos] = useState(false)

  const { currentUser, reloadUser } = useAuth()

  const MINIMUM_PLEDGE =
    typeof CONFIG.MINIMUM_PLEDGE_AMOUNT === 'string'
      ? parseInt(CONFIG.MINIMUM_PLEDGE_AMOUNT)
      : CONFIG.MINIMUM_PLEDGE_AMOUNT

  const validateEmail = (email: string) => {
    return email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)
  }

  useEffect(() => {
    if (currentUser && currentUser.email) {
      setEmail(currentUser.email)
    }
  }, [currentUser])

  const createPledge = async (pledgeSync: PledgeSync) => {
    return await api.pledges.createPledge({
      platform: organization.platform,
      orgName: organization.name,
      repoName: repository.name,
      number: issue.number,
      requestBody: {
        issue_id: issue.id,
        amount: pledgeSync.amount,
        email: pledgeSync.email,
      },
    })
  }

  const updatePledge = async (pledgeSync: PledgeSync) => {
    if (!pledge) {
      throw new Error('no pledge to update')
    }

    return await api.pledges.updatePledge({
      platform: organization.platform,
      orgName: organization.name,
      repoName: repository.name,
      number: issue.number,
      pledgeId: pledge.id,
      requestBody: {
        amount: pledgeSync.amount,
        email: pledgeSync.email,
      },
    })
  }

  const shouldSynchronizePledge = (pledgeSync: PledgeSync) => {
    if (pledgeSync.amount < MINIMUM_PLEDGE) {
      return false
    }

    if (!validateEmail(pledgeSync.email)) {
      return false
    }

    if (!pledgeSync.approvedTos) {
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

    // Sync if email has changed
    if (pledge && pledge.email !== pledgeSync.email) {
      return true
    }

    return false
  }

  const synchronizePledge = async (pledgeSync: PledgeSync) => {
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

  const onAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = parseInt(event.target.value)
    if (isNaN(amount)) {
      setErrorMessage('Please enter a valid amount')
      return
    }
    const amountInCents = amount * 100

    if (amountInCents < MINIMUM_PLEDGE) {
      setErrorMessage(
        `Minimum amount is ${getCentsInDollarString(MINIMUM_PLEDGE)}`,
      )
      return
    }

    setErrorMessage('')
    setAmount(amountInCents)
    debouncedSync({ amount: amountInCents, email, approvedTos })
  }

  type Timeout = ReturnType<typeof setTimeout>
  const syncTimeout = useRef<Timeout | null>(null)

  const debouncedSync = (pledgeSync: PledgeSync) => {
    syncTimeout.current && clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => synchronizePledge(pledgeSync), 500)
  }

  const onEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const email = event.target.value
    setEmail(email)
    debouncedSync({ amount, email, approvedTos })
  }

  const router = useRouter()

  const onStripePaymentSuccess = async (paymentIntent: PaymentIntent) => {
    // If logged in, reload the user!
    // This pledge might have allowed them to use polar
    if (currentUser) {
      await reloadUser()
    }

    if (!pledge) {
      throw new Error('got payment success but no pledge')
    }

    const location = generateRedirectURL(pledge, paymentIntent)
    await router.push(location)
  }

  const onChangeAcceptTos = (e: ChangeEvent<HTMLInputElement>) => {
    const approvedTos = e.target.checked
    setApprovedTos(approvedTos)
    debouncedSync({ amount, email, approvedTos })
  }

  const showStripeForm = pledge && approvedTos

  return (
    <>
      <form className="flex flex-col">
        <label htmlFor="amount" className="text-sm font-medium text-gray-600">
          Choose amount to pledge
        </label>
        <div className="mt-3 flex flex-row items-center space-x-4">
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

        <label
          htmlFor="email"
          className="mt-5 mb-2 text-sm font-medium text-gray-600"
        >
          Contact details
        </label>
        <input
          type="email"
          id="email"
          onChange={onEmailChange}
          onBlur={onEmailChange}
          value={email}
          className="block w-full rounded-md border-gray-200 py-3 px-4 text-sm shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
        />

        <div className="mt-5 mb-2">
          <Checkbox
            id="accept_tos"
            value={approvedTos}
            onChange={onChangeAcceptTos}
          >
            I accept the{' '}
            <Link href="https://polar.sh/legal/terms" className="underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="https://polar.sh/legal/privacy" className="underline">
              Privacy Policy
            </Link>
          </Checkbox>
        </div>

        {showStripeForm && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: pledge.client_secret,
            }}
          >
            <PaymentForm
              pledge={pledge}
              isSyncing={isSyncing}
              setSyncing={setSyncing}
              setErrorMessage={setErrorMessage}
              onSuccess={onStripePaymentSuccess}
            />
          </Elements>
        )}

        {/*
         * Unfortunately, we need to have this button (disabled) by default and then
         * remove it once Stripe is initiated. Since we cannot (in an easy/nice way)
         * manage the submission outside of the Stripe Elements context.
         */}
        {!showStripeForm && (
          <div className="mt-6">
            <PrimaryButton
              disabled={true}
              loading={isSyncing}
              onClick={() => false}
            >
              Pay ${getCentsInDollarString(MINIMUM_PLEDGE)}
            </PrimaryButton>
          </div>
        )}

        {errorMessage && <div>{errorMessage}</div>}
      </form>
    </>
  )
}
export default PledgeForm
