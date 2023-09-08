import { useAuth } from '@/hooks/auth'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { Elements } from '@stripe/react-stripe-js'
import { PaymentIntent } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import {
  ApiError,
  Issue,
  PledgeStripePaymentIntentMutationResponse,
} from 'polarkit/api/client'
import { MoneyInput, PrimaryButton } from 'polarkit/components/ui'
import { getCentsInDollarString } from 'polarkit/money'
import { classNames } from 'polarkit/utils'
import posthog from 'posthog-js'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import PaymentForm from './PaymentForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

type PledgeSync = {
  amount: number
  email: string
}

const generateRedirectURL = (
  gotoURL?: string,
  paymentIntent?: PaymentIntent,
) => {
  const redirectURL = new URL(
    window.location.origin + window.location.pathname + '/status',
  )

  if (gotoURL) {
    redirectURL.searchParams.append('goto_url', gotoURL)
  }

  // Only in case we pass our redirect to Stripe which in turn will add it
  if (!paymentIntent) {
    return redirectURL.toString()
  }

  /*
   * Same location & query params as the serverside redirect from Stripe if required
   * by the payment method - easing the implementation.
   */
  redirectURL.searchParams.append('payment_intent_id', paymentIntent.id)
  if (paymentIntent.client_secret) {
    redirectURL.searchParams.append(
      'payment_intent_client_secret',
      paymentIntent.client_secret,
    )
  }
  redirectURL.searchParams.append('redirect_status', paymentIntent.status)
  return redirectURL.toString()
}

const PledgeForm = ({
  issue,
  gotoURL,
  onAmountChange: onAmountChangeProp,
}: {
  issue: Issue
  gotoURL?: string
  onAmountChange?: (amount: number) => void
}) => {
  const [polarPaymentIntent, setPolarPaymentIntent] =
    useState<PledgeStripePaymentIntentMutationResponse | null>(null)
  const [amount, setAmount] = useState<number>(
    issue.repository.organization.pledge_minimum_amount,
  )
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isSyncing, setSyncing] = useState(false)

  const { currentUser, reloadUser } = useAuth()

  const validateEmail = (email: string) => {
    return email.includes('@')
  }

  const hasValidDetails = () => {
    let isValidEmail = validateEmail(email)
    if (!isValidEmail) {
      return false
    }

    return amount >= issue.repository.organization.pledge_minimum_amount
  }

  // Redirect to personal dashboard if authenticated unless gotoURL is set
  if (!gotoURL && currentUser) {
    gotoURL = '/feed'
  }

  useEffect(() => {
    if (currentUser && currentUser.email) {
      setEmail(currentUser.email)
      synchronizePledge({ amount, email: currentUser.email })
    }
  }, [currentUser])

  const { resolvedTheme } = useTheme()

  const createPaymentIntent = async (pledgeSync: PledgeSync) => {
    return await api.pledges.createPaymentIntent({
      requestBody: {
        issue_id: issue.id,
        amount: pledgeSync.amount,
        email: pledgeSync.email,
      },
    })
  }

  const updatePaymentIntent = async (pledgeSync: PledgeSync) => {
    if (!polarPaymentIntent) {
      throw new Error('no payment intent to update')
    }

    return await api.pledges.updatePaymentIntent({
      id: polarPaymentIntent.payment_intent_id,
      requestBody: {
        amount: pledgeSync.amount,
        email: pledgeSync.email,
      },
    })
  }

  const shouldSynchronizePledge = (pledgeSync: PledgeSync) => {
    if (
      pledgeSync.amount < issue.repository.organization.pledge_minimum_amount
    ) {
      return false
    }

    if (!validateEmail(pledgeSync.email)) {
      return false
    }

    return true
  }

  const synchronizePledge = async (pledgeSync: PledgeSync) => {
    if (!shouldSynchronizePledge(pledgeSync)) {
      return
    }

    setSyncing(true)
    setErrorMessage('')

    let updatedPaymentIntent:
      | PledgeStripePaymentIntentMutationResponse
      | undefined

    try {
      if (!polarPaymentIntent) {
        updatedPaymentIntent = await createPaymentIntent(pledgeSync)
      } else {
        updatedPaymentIntent = await updatePaymentIntent(pledgeSync)
      }

      if (updatedPaymentIntent) {
        setPolarPaymentIntent(updatedPaymentIntent)
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (
          e.message === 'Bad Request' &&
          e.body &&
          e.body.detail === 'Invalid Stripe Request'
        ) {
          // Probably a invalid email according to Stripe. Ignore this error.
        } else {
          // We didn't handle this error, raise it again.
          setErrorMessage('Something went wrong, please try again')
        }
      }
    }

    setSyncing(false)
  }

  const onAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    let newAmount = parseInt(event.target.value)
    if (isNaN(newAmount)) {
      newAmount = 0
    }
    const amountInCents = newAmount * 100

    if (amount === issue.repository.organization.pledge_minimum_amount) {
      posthog.capture('Pledge amount changed', {
        Amount: newAmount,
        'Organization ID': issue.repository.organization.id,
        'Organization Name': issue.repository.organization.name,
        'Repository ID': issue.repository.id,
        'Repository Name': issue.repository.name,
        'Issue ID': issue.id,
        'Issue Number': issue.number,
      })
    }

    if (onAmountChangeProp) {
      onAmountChangeProp(amountInCents)
    }

    setAmount(amountInCents)
    debouncedSync({ amount: amountInCents, email })
  }

  type Timeout = ReturnType<typeof setTimeout>
  const syncTimeout = useRef<Timeout | null>(null)

  const debouncedSync = (pledgeSync: PledgeSync) => {
    syncTimeout.current && clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => synchronizePledge(pledgeSync), 500)
  }

  const onEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newEmail = event.target.value

    if (email === '') {
      posthog.capture('Pledge email entered', {
        'Organization ID': issue.repository.organization.id,
        'Organization Name': issue.repository.organization.name,
        'Repository ID': issue.repository.id,
        'Repository Name': issue.repository.name,
        'Issue ID': issue.id,
        'Issue Number': issue.number,
      })
    }

    setEmail(newEmail)
    debouncedSync({ amount, email: newEmail })
  }

  const router = useRouter()

  const onStripePaymentSuccess = async (paymentIntent: PaymentIntent) => {
    // If logged in, reload the user!
    // This pledge might have allowed them to use polar
    if (currentUser) {
      await reloadUser()
    }

    if (!paymentIntent) {
      throw new Error('got payment success but no pledge')
    }

    const location = generateRedirectURL(gotoURL, paymentIntent)
    await router.push(location)
  }

  const showStripeForm = polarPaymentIntent ? true : false
  const organization = issue.repository.organization
  const repository = issue.repository

  return (
    <>
      <form className="flex flex-col">
        <label
          htmlFor="amount"
          className="text-sm font-medium text-gray-500 dark:text-gray-400"
        >
          Funding amount
        </label>
        <div className="mt-2 flex flex-row items-center space-x-4">
          <MoneyInput
            id="amount"
            name="amount"
            onChange={onAmountChange}
            onBlur={onAmountChange}
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
            onChange={onEmailChange}
            onBlur={onEmailChange}
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

        {showStripeForm && polarPaymentIntent && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: polarPaymentIntent.client_secret,
              appearance: {
                rules: {
                  '.Label': {
                    color: resolvedTheme === 'dark' ? '#A3A3A3' : '#727374',
                    fontWeight: '500',
                    fontSize: '14px',
                    marginBottom: '8px',
                  },
                  '.Input': {
                    padding: '12px',
                    backgroundColor: 'transparent',
                    borderColor:
                      resolvedTheme === 'dark' ? '#505153' : '#E5E5E1',
                    color: resolvedTheme === 'dark' ? '#E5E5E1' : '#181A1F',
                  },
                  '.Input:focus': {
                    borderColor:
                      resolvedTheme === 'dark' ? '#4667CA' : '#A5C2EB',
                  },
                },
                variables: {
                  borderRadius: '8px',
                  fontFamily: '"Inter var", Inter, sans-serif',
                  fontSizeBase: '14px',
                  spacingGridRow: '18px',
                  colorDanger: resolvedTheme === 'dark' ? '#F17878' : '#E64D4D',
                },
              },
              fonts: [
                {
                  cssSrc:
                    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500',
                },
              ],
            }}
          >
            <PaymentForm
              paymentIntent={polarPaymentIntent}
              issue={issue}
              organization={organization}
              repository={repository}
              isSyncing={isSyncing}
              setSyncing={setSyncing}
              setErrorMessage={setErrorMessage}
              onSuccess={onStripePaymentSuccess}
              hasDetails={hasValidDetails()}
              redirectTo={generateRedirectURL(gotoURL)}
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
              Fund this issue
            </PrimaryButton>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3.5 text-red-500 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        <p className="mt-5 text-sm text-gray-600">
          By funding this issue, you agree to our{' '}
          <Link href="https://polar.sh/legal/terms" className="underline">
            Terms of Service
          </Link>{' '}
          and understand our{' '}
          <Link href="https://polar.sh/legal/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </>
  )
}
export default PledgeForm
