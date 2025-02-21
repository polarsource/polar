import { useAuth } from '@/hooks/auth'
import { usePostHog } from '@/hooks/posthog'
import { api } from '@/utils/client'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import { getCentsInDollarString } from '@polar-sh/ui/lib/money'
import { Elements } from '@stripe/react-stripe-js'
import { PaymentIntent } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import OrganizationSelect from './OrganizationSelect'
import { generateRedirectURL, validateEmail } from './payment'
import PaymentForm from './PaymentForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

type PledgeFormState = {
  amount: number
  email: string
  setup_future_usage:
    | schemas['PledgeStripePaymentIntentCreate']['setup_future_usage']
    | undefined
  on_behalf_of_organization_id: string | undefined
}

const PledgeCheckoutFundToday = ({
  issue,
  organization,
  gotoURL,
  onAmountChange: onAmountChangeProp,
}: {
  issue: schemas['Issue']
  organization: schemas['Organization']
  gotoURL?: string
  onAmountChange?: (amount: number) => void
}) => {
  const posthog = usePostHog()
  const [polarPaymentIntent, setPolarPaymentIntent] = useState<
    schemas['PledgeStripePaymentIntentMutationResponse'] | null
  >(null)

  const [formState, setFormState] = useState<PledgeFormState>({
    amount: organization.pledge_minimum_amount,
    email: '',
    setup_future_usage: undefined,
    on_behalf_of_organization_id: undefined,
  })

  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isSyncing, setSyncing] = useState(false)

  const { currentUser } = useAuth()

  const hasValidDetails = () => {
    let isValidEmail = validateEmail(formState.email)
    if (!isValidEmail) {
      return false
    }

    return formState.amount >= organization.pledge_minimum_amount
  }

  // Redirect to personal dashboard if authenticated unless gotoURL is set
  if (!gotoURL && currentUser) {
    gotoURL = '/funding'
  }

  const { resolvedTheme } = useTheme()

  const lastPledgeSync = useRef<PledgeFormState | undefined>()

  const createPaymentIntent = useCallback(
    async (pledgeSync: PledgeFormState) => {
      return unwrap(
        api.POST('/v1/pledges/payment_intent', {
          body: {
            issue_id: issue.id,
            amount: pledgeSync.amount,
            email: pledgeSync.email,
            on_behalf_of_organization_id:
              pledgeSync.on_behalf_of_organization_id,
            currency: 'usd',
          },
        }),
      )
    },
    [issue.id],
  )

  const updatePaymentIntent = useCallback(
    async (pledgeSync: PledgeFormState) => {
      if (!polarPaymentIntent) {
        throw new Error('no payment intent to update')
      }

      return await unwrap(
        api.PATCH('/v1/pledges/payment_intent/{id}', {
          params: { path: { id: polarPaymentIntent.payment_intent_id } },
          body: {
            amount: pledgeSync.amount,
            email: pledgeSync.email,
            setup_future_usage: pledgeSync.setup_future_usage,
            on_behalf_of_organization_id:
              pledgeSync.on_behalf_of_organization_id,
            currency: 'usd',
          },
        }),
      )
    },
    [polarPaymentIntent],
  )

  const shouldSynchronizePledge = useCallback(
    (pledgeSync: PledgeFormState) => {
      if (pledgeSync.amount < organization.pledge_minimum_amount) {
        return false
      }

      if (!validateEmail(pledgeSync.email)) {
        return false
      }

      if (lastPledgeSync.current === undefined) {
        return true
      }

      if (
        lastPledgeSync.current.amount !== pledgeSync.amount ||
        lastPledgeSync.current.email !== pledgeSync.email ||
        lastPledgeSync.current.setup_future_usage !==
          pledgeSync.setup_future_usage ||
        lastPledgeSync.current.on_behalf_of_organization_id !==
          pledgeSync.on_behalf_of_organization_id
      ) {
        return true
      }

      return false
    },
    [organization],
  )

  const synchronizePledge = useCallback(
    async (pledgeSync: PledgeFormState) => {
      if (!shouldSynchronizePledge(pledgeSync)) {
        return
      }

      setSyncing(true)
      setErrorMessage('')

      let updatedPaymentIntent: schemas['PledgeStripePaymentIntentMutationResponse']

      if (!polarPaymentIntent) {
        updatedPaymentIntent = await createPaymentIntent(pledgeSync)
      } else {
        updatedPaymentIntent = await updatePaymentIntent(pledgeSync)
      }

      if (updatedPaymentIntent) {
        setPolarPaymentIntent(updatedPaymentIntent)
      }
      lastPledgeSync.current = pledgeSync

      setSyncing(false)
    },
    [
      createPaymentIntent,
      updatePaymentIntent,
      polarPaymentIntent,
      shouldSynchronizePledge,
    ],
  )

  const didFirstUserEmailSync = useRef(false)

  useEffect(() => {
    if (currentUser && currentUser.email && !didFirstUserEmailSync.current) {
      didFirstUserEmailSync.current = true

      const n = {
        ...formState,
        email: currentUser.email,
      }
      setFormState(n)
      synchronizePledge(n)
    }
  }, [currentUser, formState, synchronizePledge])

  const onAmountChange = (amount: number) => {
    if (formState.amount === organization.pledge_minimum_amount) {
      posthog.capture('storefront:issues:pledge_amount:update', {
        amount,
        organization_id: issue.repository.organization.id,
        organization_name: issue.repository.organization.name,
        repository_id: issue.repository.id,
        repository_name: issue.repository.name,
        issue_id: issue.id,
        issue_number: issue.number,
      })
    }

    if (onAmountChangeProp) {
      onAmountChangeProp(amount)
    }

    const n = {
      ...formState,
      amount,
    }
    setFormState(n)
    debouncedSync(n)
  }

  type Timeout = ReturnType<typeof setTimeout>
  const syncTimeout = useRef<Timeout | null>(null)

  const debouncedSync = (pledgeSync: PledgeFormState) => {
    syncTimeout.current && clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => synchronizePledge(pledgeSync), 500)
  }

  const onEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newEmail = event.target.value

    if (formState.email === '') {
      posthog.capture('storefront:issues:pledge_email:update', {
        organization_id: issue.repository.organization.id,
        organization_name: issue.repository.organization.name,
        repository_id: issue.repository.id,
        repository_name: issue.repository.name,
        issue_id: issue.id,
        issue_number: issue.number,
      })
    }

    const n = {
      ...formState,
      email: newEmail,
    }
    setFormState(n)
    debouncedSync(n)
  }

  const router = useRouter()

  const onStripePaymentSuccess = async (paymentIntent: PaymentIntent) => {
    if (!paymentIntent) {
      throw new Error('got payment success but no pledge')
    }

    const location = generateRedirectURL(
      gotoURL,
      paymentIntent,
      formState.email,
    )
    router.push(location)
  }

  const showStripeForm = polarPaymentIntent ? true : false
  const repository = issue.repository

  const onChangeOnBehalfOf = (org: schemas['Organization'] | undefined) => {
    const n = {
      ...formState,
      on_behalf_of_organization_id: org ? org.id : undefined,
    }
    setFormState(n)
    debouncedSync(n)
  }

  return (
    <div className="flex flex-col space-y-4 py-4">
      <div>
        <label
          htmlFor="amount"
          className="dark:text-polar-200 mb-2 text-sm font-medium text-gray-500"
        >
          Funding amount
        </label>
        <div className="mt-2 flex flex-row items-center space-x-4">
          <MoneyInput
            id="amount"
            name="amount"
            onChange={onAmountChange}
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

      <OrganizationSelect
        onChange={onChangeOnBehalfOf}
        allowSelfSelect={true}
      />

      <div>
        <label
          htmlFor="email"
          className="dark:text-polar-200 mb-2 text-sm font-medium text-gray-500"
        >
          Contact details
        </label>
        <div className="relative mt-2">
          <Input
            type="email"
            id="email"
            onChange={onEmailChange}
            onBlur={onEmailChange}
            value={formState.email}
            className="block w-full pl-11"
            onFocus={(event) => {
              event.target.select()
            }}
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-lg">
            <span className="dark:text-polar-500 text-gray-500">
              <EnvelopeIcon className="h-6 w-6" />
            </span>
          </div>
        </div>
      </div>

      {showStripeForm && polarPaymentIntent && (
        <Elements
          stripe={stripePromise}
          options={{
            ...(polarPaymentIntent.client_secret
              ? { clientSecret: polarPaymentIntent.client_secret }
              : {}),
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
                  borderColor: resolvedTheme === 'dark' ? '#505153' : '#E5E5E1',
                  color: resolvedTheme === 'dark' ? '#E5E5E1' : '#181A1F',
                },
                '.Input:focus': {
                  borderColor: resolvedTheme === 'dark' ? '#4667CA' : '#A5C2EB',
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
          <Button
            size="lg"
            disabled={true}
            loading={isSyncing}
            onClick={() => false}
            fullWidth
          >
            Fund this issue
          </Button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3.5 text-red-500 dark:text-red-400">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

export default PledgeCheckoutFundToday
