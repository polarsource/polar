import { useAuth } from '@/hooks/auth'
import {
  ClockIcon,
  CurrencyDollarIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import { CommandLineIcon, HeartIcon } from '@heroicons/react/24/solid'
import {
  Issue,
  Organization,
  PaymentMethod,
  PledgeStripePaymentIntentCreateSetupFutureUsageEnum,
  PledgeStripePaymentIntentMutationResponse,
  ResponseError,
} from '@polar-sh/sdk'
import { Elements } from '@stripe/react-stripe-js'
import { PaymentIntent } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import {
  Input,
  MoneyInput,
  PrimaryButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { useListPaymentMethods } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import posthog from 'posthog-js'
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Contribute from './Contribute'
import FundOnCompletion from './FundOnCompletion'
import OnBehalfOf from './OnBehalfOf'
import PaymentForm from './PaymentForm'
import { prettyCardName, validateEmail } from './payment'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

type PledgeFormState = {
  amount: number
  email: string
  setup_future_usage:
    | PledgeStripePaymentIntentCreateSetupFutureUsageEnum
    | undefined
  on_behalf_of_organization_id: string | undefined
}

const generateRedirectURL = (
  gotoURL?: string,
  paymentIntent?: PaymentIntent,
  email?: string,
) => {
  const redirectURL = new URL(
    window.location.origin + window.location.pathname + '/status',
  )

  if (gotoURL) {
    redirectURL.searchParams.append('goto_url', gotoURL)
  }

  if (email) {
    redirectURL.searchParams.append('email', email)
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
  return (
    <>
      <form className="flex flex-col">
        <label
          htmlFor="action"
          className="dark:text-polar-200 mb-2 text-sm font-medium text-gray-500"
        >
          I want to&hellip;
        </label>

        <Tabs defaultValue="fund" className="">
          <TabsList className="w-full">
            <TabsTrigger
              value="fund"
              className="data-[state=active]:text-red-600 dark:data-[state=active]:text-red-600"
            >
              <HeartIcon className="h-4 w-4" />
              <div className="dark:text-polar-300 text-gray-700">Fund</div>
            </TabsTrigger>

            <TabsTrigger
              value="contribute"
              className="data-[state=active]:text-green-400 dark:data-[state=active]:text-green-400"
            >
              <CommandLineIcon className="h-4 w-4" />
              <div className="dark:text-polar-300 text-gray-700">
                Contribute
              </div>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="fund">
            <Fund
              issue={issue}
              gotoURL={gotoURL}
              onAmountChange={onAmountChangeProp}
            />
          </TabsContent>
          <TabsContent value="contribute">
            <Contribute issue={issue} />
          </TabsContent>
        </Tabs>
      </form>
    </>
  )
}

export default PledgeForm

const Fund = ({
  issue,
  gotoURL,
  onAmountChange: onAmountChangeProp,
}: {
  issue: Issue
  gotoURL?: string
  onAmountChange?: (amount: number) => void
}) => {
  return (
    <div className="space-y-4 py-4">
      <div>
        <label
          htmlFor="funding_method"
          className="dark:text-polar-200 mb-2 text-sm font-medium text-gray-500"
        >
          Funding method
        </label>

        <Tabs defaultValue="fund_today" className="mt-2">
          <TabsList className="w-full" vertical>
            <FundingMethodTab
              value="fund_today"
              icon={<CurrencyDollarIcon className="h-6 w-6" />}
              title="Fund today"
              subtitle="Paid today. Held by Polar until completion."
            />
            <FundingMethodTab
              value="fund_on_completion"
              icon={<ClockIcon className="h-6 w-6" />}
              title="Fund on completion"
              subtitle="Get an invoice when the issue is completed."
            />
          </TabsList>
          <TabsContent value="fund_today">
            <FundToday
              issue={issue}
              gotoURL={gotoURL}
              onAmountChange={onAmountChangeProp}
            />
          </TabsContent>
          <TabsContent value="fund_on_completion">
            <FundOnCompletion issue={issue} gotoURL={gotoURL} />
          </TabsContent>
        </Tabs>
      </div>

      <p className="dark:text-polar-500 text-sm text-gray-600">
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
    </div>
  )
}

const FundingMethodTab = ({
  value,
  icon,
  title,
  subtitle,
}: {
  value: string
  icon: React.ReactElement
  title: string
  subtitle: string
}) => (
  <TabsTrigger value={value} className="w-full md:flex-col md:items-center">
    <div className="flex w-full items-center gap-4 px-1 text-left">
      <div className="shrink-0">{icon}</div>
      <div className="w-full">
        <div>{title}</div>
        <div className="w-full truncate text-xs font-normal opacity-50">
          {subtitle}
        </div>
      </div>
    </div>
  </TabsTrigger>
)

const FundToday = ({
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

  const [formState, setFormState] = useState<PledgeFormState>({
    amount: issue.repository.organization.pledge_minimum_amount,
    email: '',
    setup_future_usage: undefined,
    on_behalf_of_organization_id: undefined,
  })

  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isSyncing, setSyncing] = useState(false)

  const { currentUser, reloadUser } = useAuth()

  const savedPaymentMethods = useListPaymentMethods()

  const hasValidDetails = () => {
    let isValidEmail = validateEmail(formState.email)
    if (!isValidEmail) {
      return false
    }

    return (
      formState.amount >= issue.repository.organization.pledge_minimum_amount
    )
  }

  // Redirect to personal dashboard if authenticated unless gotoURL is set
  if (!gotoURL && currentUser) {
    gotoURL = '/feed'
  }

  const { resolvedTheme } = useTheme()

  const lastPledgeSync = useRef<PledgeFormState | undefined>()

  const createPaymentIntent = useCallback(
    async (pledgeSync: PledgeFormState) => {
      return await api.pledges.createPaymentIntent({
        pledgeStripePaymentIntentCreate: {
          issue_id: issue.id,
          amount: pledgeSync.amount,
          email: pledgeSync.email,
          on_behalf_of_organization_id: pledgeSync.on_behalf_of_organization_id,
        },
      })
    },
    [issue.id],
  )

  const updatePaymentIntent = useCallback(
    async (pledgeSync: PledgeFormState) => {
      if (!polarPaymentIntent) {
        throw new Error('no payment intent to update')
      }

      return await api.pledges.updatePaymentIntent({
        id: polarPaymentIntent.payment_intent_id,
        pledgeStripePaymentIntentUpdate: {
          amount: pledgeSync.amount,
          email: pledgeSync.email,
          setup_future_usage: pledgeSync.setup_future_usage,
          on_behalf_of_organization_id: pledgeSync.on_behalf_of_organization_id,
        },
      })
    },
    [polarPaymentIntent],
  )

  const shouldSynchronizePledge = useCallback(
    (pledgeSync: PledgeFormState) => {
      if (
        pledgeSync.amount < issue.repository.organization.pledge_minimum_amount
      ) {
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
    [issue.repository.organization.pledge_minimum_amount],
  )

  const synchronizePledge = useCallback(
    async (pledgeSync: PledgeFormState) => {
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
        lastPledgeSync.current = pledgeSync
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (body && body['detail'] === 'Invalid Stripe Request') {
            // Probably a invalid email according to Stripe. Ignore this error.
          } else {
            // We didn't handle this error, raise it again.
            setErrorMessage('Something went wrong, please try again')
          }
        }
      }

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

  const onAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    let newAmount = parseInt(event.target.value)
    if (isNaN(newAmount)) {
      newAmount = 0
    }
    const amountInCents = newAmount * 100

    if (
      formState.amount === issue.repository.organization.pledge_minimum_amount
    ) {
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

    const n = {
      ...formState,
      amount: amountInCents,
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
      posthog.capture('Pledge email entered', {
        'Organization ID': issue.repository.organization.id,
        'Organization Name': issue.repository.organization.name,
        'Repository ID': issue.repository.id,
        'Repository Name': issue.repository.name,
        'Issue ID': issue.id,
        'Issue Number': issue.number,
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
    // If logged in, reload the user!
    // This pledge might have allowed them to use polar
    if (currentUser) {
      await reloadUser()
    }

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

  const [paymentMethod, setPaymentMethod] = useState<
    PaymentMethod | undefined
  >()
  const showStripeForm = polarPaymentIntent ? true : false
  const organization = issue.repository.organization
  const repository = issue.repository

  const onSavePaymentMethodChanged = (save: boolean) => {
    const n = {
      ...formState,
      setup_future_usage: save
        ? PledgeStripePaymentIntentCreateSetupFutureUsageEnum.ON_SESSION
        : undefined,
    }

    setFormState(n)
    debouncedSync(n)
  }

  const onPaymentMethodChange = (id: string) => {
    const pm = savedPaymentMethods.data?.items?.find(
      (p) => p.stripe_payment_method_id === id,
    )
    setPaymentMethod(pm)
  }

  const didSetPaymentMethodOnLoad = useRef(false)
  useEffect(() => {
    if (didSetPaymentMethodOnLoad.current) {
      return
    }
    if (!savedPaymentMethods.isFetched) {
      return
    }

    if (
      savedPaymentMethods.data?.items &&
      savedPaymentMethods.data?.items.length >= 1
    ) {
      setPaymentMethod(savedPaymentMethods.data?.items[0])
    }

    didSetPaymentMethodOnLoad.current = true
  }, [savedPaymentMethods.isFetched, savedPaymentMethods.data])

  const onChangeOnBehalfOf = (org: Organization | undefined) => {
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
            onBlur={onAmountChange}
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

      <OnBehalfOf onChange={onChangeOnBehalfOf} />

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

      {savedPaymentMethods.data?.items &&
        savedPaymentMethods.data?.items?.length > 0 && (
          <div>
            <label
              htmlFor="payment_method"
              className="dark:text-polar-400 text-sm font-medium text-gray-500"
            >
              Payment method
            </label>

            <Select onValueChange={onPaymentMethodChange} name="payment_method">
              <SelectTrigger className="mt-2 w-full">
                {paymentMethod ? (
                  <SelectValue
                    placeholder={`${prettyCardName(paymentMethod.brand)} (****${
                      paymentMethod.last4
                    }) 
                    ${paymentMethod.exp_month.toString().padStart(2, '0')}/${
                      paymentMethod.exp_year
                    }`}
                  />
                ) : (
                  <SelectValue placeholder="new" />
                )}
              </SelectTrigger>

              <SelectContent>
                {savedPaymentMethods.data.items.map((pm) => (
                  <SelectItem
                    value={pm.stripe_payment_method_id}
                    key={pm.stripe_payment_method_id}
                  >
                    {prettyCardName(pm.brand)} (****{pm.last4}){' '}
                    {pm.exp_month.toString().padStart(2, '0')}/{pm.exp_year}
                  </SelectItem>
                ))}
                <SelectItem value="new">+ New payment method</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
            canSavePaymentMethod={currentUser !== undefined}
            paymentMethod={paymentMethod}
            onSavePaymentMethodChanged={onSavePaymentMethodChanged}
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
    </div>
  )
}
