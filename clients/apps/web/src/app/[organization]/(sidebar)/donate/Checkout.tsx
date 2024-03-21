import { validateEmail } from '@/components/Pledge/payment'
import { useAuth } from '@/hooks'
import {
  DonationCreateStripePaymentIntent,
  DonationStripePaymentIntentMutationResponse,
  DonationUpdateStripePaymentIntent,
  Organization,
  ResponseError,
} from '@polar-sh/sdk'
import { Elements } from '@stripe/react-stripe-js'
import { PaymentIntent } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit/api'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import MoneyInput from 'polarkit/components/ui/atoms/moneyinput'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Banner } from 'polarkit/components/ui/molecules'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import PaymentForm from './PaymentForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

type DonateFormState = DonationCreateStripePaymentIntent &
  DonationUpdateStripePaymentIntent

const Checkout = ({ organization }: { organization: Organization }) => {
  const [polarPaymentIntent, setPolarPaymentIntent] =
    useState<DonationStripePaymentIntentMutationResponse | null>(null)

  const [isSyncing, setIsSyncing] = useState(false)

  const lastPledgeSync = useRef<DonateFormState | undefined>()

  const createPaymentIntent = useCallback(
    async (pledgeSync: DonateFormState) => {
      return await api.donations.createPaymentIntent({
        donationCreateStripePaymentIntent: {
          to_organization_id: pledgeSync.to_organization_id,
          amount: pledgeSync.amount,
          email: pledgeSync.email,
          setup_future_usage: pledgeSync.setup_future_usage,
          on_behalf_of_organization_id: pledgeSync.on_behalf_of_organization_id,
        },
      })
    },
    [organization.id],
  )

  const updatePaymentIntent = useCallback(
    async (pledgeSync: DonateFormState) => {
      if (!polarPaymentIntent) {
        throw new Error('no payment intent to update')
      }

      return await api.donations.updatePaymentIntent({
        id: polarPaymentIntent.payment_intent_id,
        donationUpdateStripePaymentIntent: {
          amount: pledgeSync.amount,
          email: pledgeSync.email,
          setup_future_usage: pledgeSync.setup_future_usage,
          on_behalf_of_organization_id: pledgeSync.on_behalf_of_organization_id,
        },
      })
    },
    [polarPaymentIntent],
  )

  const shouldSynchronizePledge = (pledgeSync: DonateFormState) => {
    console.log({
      pledgeSync: pledgeSync.amount.amount,
      lastPledgeSync: lastPledgeSync.current?.amount.amount,
    })

    if (!validateEmail(pledgeSync.email)) {
      console.log('invalid email')
      return false
    }
    if (pledgeSync.amount.amount <= 0) {
      console.log('low amount')
      return false
    }

    if (lastPledgeSync.current === undefined) {
      return true
    }

    if (
      lastPledgeSync.current.amount.currency !== pledgeSync.amount.currency ||
      lastPledgeSync.current.amount.amount !== pledgeSync.amount.amount ||
      lastPledgeSync.current.email !== pledgeSync.email ||
      lastPledgeSync.current.setup_future_usage !==
        pledgeSync.setup_future_usage ||
      lastPledgeSync.current.on_behalf_of_organization_id !==
        pledgeSync.on_behalf_of_organization_id
    ) {
      return true
    }

    console.log('not changed')
    return false
  }

  const synchronizePledge = useCallback(
    async (pledgeSync: DonateFormState) => {
      console.log('synchronizePledge')

      if (!shouldSynchronizePledge(pledgeSync)) {
        console.log('should not sync')
        return
      }

      setIsSyncing(true)

      let updatedPaymentIntent:
        | DonationStripePaymentIntentMutationResponse
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
        console.log('set synced')
        lastPledgeSync.current = {
          ...pledgeSync,
          amount: { ...pledgeSync.amount },
        }
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (body && body['detail'] === 'Invalid Stripe Request') {
            // Probably a invalid email according to Stripe. Ignore this error.
          } else {
            // We didn't handle this error, raise it again.
            alert('Something went wrong, please try again')
          }
        }
      }

      setIsSyncing(false)
    },
    [
      createPaymentIntent,
      updatePaymentIntent,
      polarPaymentIntent,
      shouldSynchronizePledge,
    ],
  )

  type Timeout = ReturnType<typeof setTimeout>
  const syncTimeout = useRef<Timeout | null>(null)

  const debouncedSync = (pledgeSync: DonateFormState) => {
    syncTimeout.current && clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(() => synchronizePledge(pledgeSync), 500)
  }

  const { currentUser } = useAuth()

  const form = useForm<DonationCreateStripePaymentIntent>({
    defaultValues: {
      to_organization_id: organization.id,
      amount: { amount: 1000, currency: 'USD' },
      email: currentUser?.email ?? undefined,
    },
  })

  const { handleSubmit, watch, trigger } = form

  const onSubmit = () => {}

  const amount = watch('amount')
  const amountAmount = watch('amount.amount')
  const email = watch('email')

  useEffect(() => {
    // Trigger form validation on all fields
    trigger(undefined)

    debouncedSync(form.getValues())
  }, [amount, email, amountAmount])

  return (
    <>
      <div className="dark:text-polar-500 space-y-2 p-4 text-sm text-gray-500">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <DonationAmount />
            <Email />

            {polarPaymentIntent ? (
              <StripeForm
                isSyncing={isSyncing}
                polarPaymentIntent={polarPaymentIntent}
              />
            ) : null}

            <div className="flex flex-row items-center gap-x-4">
              <Button fullWidth={false} variant="secondary" loading={false}>
                <span>Donate</span>
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </>
  )
}

export default Checkout

const DonationAmount = () => {
  const { control } = useFormContext<DonationCreateStripePaymentIntent>()

  return (
    <>
      <FormField
        control={control}
        name="amount.amount"
        rules={{
          required: 'This field is required',
          min: 0,
          max: 1000000000,
        }}
        render={({ field }) => (
          <FormItem className="flex flex-col items-start justify-between">
            <div className="flex flex-col gap-y-2">
              <FormLabel className="dark:text-polar-50 text-gray-950">
                Amount
              </FormLabel>
              <FormMessage />
            </div>
            <FormControl>
              <div className="w-[260px]">
                <MoneyInput
                  id={''}
                  {...field}
                  placeholder={2000}
                  value={field.value}
                  onChange={undefined}
                  onAmountChangeInCents={(cents) => field.onChange(cents)}
                />
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}

const Email = () => {
  const { control } = useFormContext<DonationCreateStripePaymentIntent>()

  return (
    <>
      <FormField
        control={control}
        name="email"
        rules={{
          required: 'This field is required',
          minLength: 3,
          maxLength: 64,
          pattern: {
            value: /\S+@\S+\.\S+/,
            message: 'Entered value does not match email format',
          },
        }}
        render={({ field }) => (
          <FormItem className="flex flex-col items-start justify-between">
            <div className="flex flex-col gap-y-2">
              <FormLabel className="dark:text-polar-50 text-gray-950">
                Billing email
              </FormLabel>
              <FormMessage />
            </div>
            <FormControl>
              <div className="w-[260px]">
                <Input {...field} placeholder="billing@example.com" />
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}

const StripeForm = ({
  polarPaymentIntent,
  isSyncing,
}: {
  polarPaymentIntent: DonationStripePaymentIntentMutationResponse
  isSyncing: boolean
}) => {
  const { resolvedTheme } = useTheme()
  const { currentUser } = useAuth()

  const { formState, watch } =
    useFormContext<DonationCreateStripePaymentIntent>()

  const router = useRouter()

  const email = watch('email')

  const [errorMessage, setErrorMessage] = useState<string>()

  const onStripePaymentSuccess = async (paymentIntent: PaymentIntent) => {
    if (!paymentIntent) {
      throw new Error('got payment success but no payment intent')
    }
    const location = generateDonationRedirectURL(paymentIntent, email)
    router.push(location)
  }

  return (
    <>
      <pre>
        {JSON.stringify(
          { formState, valid: formState.isValid, errors: formState.errors },
          undefined,
          2,
        )}
      </pre>
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
          isSyncing={isSyncing}
          setErrorMessage={setErrorMessage}
          onSuccess={onStripePaymentSuccess}
          canSavePaymentMethod={currentUser !== undefined}
          paymentMethod={undefined}
          onSavePaymentMethodChanged={() => {}}
          isValid={formState.isValid}
          redirectTo={generateDonationRedirectURL()}
        />
      </Elements>
      {errorMessage ? <Banner color="red">{errorMessage}</Banner> : null}
    </>
  )
}

export const generateDonationRedirectURL = (
  paymentIntent?: PaymentIntent,
  email?: string,
) => {
  const redirectURL = new URL(
    window.location.origin + window.location.pathname + '/status',
  )

  if (email) {
    redirectURL.searchParams.append('email', email)
  }

  // Server side redirect
  // Extra parameters are added by Stripe
  if (!paymentIntent) {
    return redirectURL.toString()
  }

  // Client side redirect
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
