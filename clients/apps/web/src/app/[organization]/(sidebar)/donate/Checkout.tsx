import { prettyCardName, validateEmail } from '@/components/Pledge/payment'
import { useAuth } from '@/hooks'
import {
  DonationCreateStripePaymentIntent,
  DonationStripePaymentIntentMutationResponse,
  DonationUpdateStripePaymentIntent,
  Organization,
  PaymentMethod,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Banner } from 'polarkit/components/ui/molecules'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { Textarea } from 'polarkit/components/ui/textarea'
import { useListPaymentMethods } from 'polarkit/hooks'
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

  const latestFormSyncedState = useRef<DonateFormState | undefined>()

  const createPaymentIntent = async (formState: DonateFormState) => {
    return await api.donations.createPaymentIntent({
      donationCreateStripePaymentIntent: {
        to_organization_id: formState.to_organization_id,
        amount: formState.amount,
        email: formState.email,
        setup_future_usage: formState.setup_future_usage,
        on_behalf_of_organization_id: formState.on_behalf_of_organization_id,
        message: formState.message,
      },
    })
  }

  const updatePaymentIntent = useCallback(
    async (formState: DonateFormState) => {
      if (!polarPaymentIntent) {
        throw new Error('no payment intent to update')
      }

      return await api.donations.updatePaymentIntent({
        id: polarPaymentIntent.payment_intent_id,
        donationUpdateStripePaymentIntent: {
          amount: formState.amount,
          email: formState.email,
          setup_future_usage: formState.setup_future_usage,
          on_behalf_of_organization_id: formState.on_behalf_of_organization_id,
          message: formState.message,
        },
      })
    },
    [polarPaymentIntent],
  )

  const shouldSynchronizePaymentIntent = (formState: DonateFormState) => {
    if (!validateEmail(formState.email)) {
      return false
    }

    if (formState.amount.amount <= 0) {
      return false
    }

    if (latestFormSyncedState.current === undefined) {
      return true
    }

    if (
      latestFormSyncedState.current.amount.currency !==
        formState.amount.currency ||
      latestFormSyncedState.current.amount.amount !== formState.amount.amount ||
      latestFormSyncedState.current.email !== formState.email ||
      latestFormSyncedState.current.setup_future_usage !==
        formState.setup_future_usage ||
      latestFormSyncedState.current.on_behalf_of_organization_id !==
        formState.on_behalf_of_organization_id ||
      latestFormSyncedState.current.message !== formState.message
    ) {
      return true
    }

    return false
  }

  const synchronizePaymentIntent = useCallback(
    async (formState: DonateFormState) => {
      if (!shouldSynchronizePaymentIntent(formState)) {
        setIsSyncing(false)
        return
      }

      setIsSyncing(true)

      let updatedPaymentIntent:
        | DonationStripePaymentIntentMutationResponse
        | undefined

      try {
        if (!polarPaymentIntent) {
          updatedPaymentIntent = await createPaymentIntent(formState)
        } else {
          updatedPaymentIntent = await updatePaymentIntent(formState)
        }

        if (updatedPaymentIntent) {
          setPolarPaymentIntent(updatedPaymentIntent)
        }

        latestFormSyncedState.current = {
          ...formState,
          amount: { ...formState.amount },
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
      shouldSynchronizePaymentIntent,
    ],
  )

  type Timeout = ReturnType<typeof setTimeout>
  const syncTimeout = useRef<Timeout | null>(null)

  const debouncedSync = (formState: DonateFormState) => {
    // Early user feedback that we're about to sync
    if (shouldSynchronizePaymentIntent(formState)) {
      setIsSyncing(true)
    }

    syncTimeout.current && clearTimeout(syncTimeout.current)
    syncTimeout.current = setTimeout(
      () => synchronizePaymentIntent(formState),
      500,
    )
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
  const emailState = form.getFieldState('email')
  const message = watch('message')

  useEffect(() => {
    // For logged out users, do not run validation until the user has entered an email address.
    if (!email && !emailState.isTouched) {
      return
    }

    // Trigger form validation on all fields
    trigger(undefined)

    debouncedSync(form.getValues())
  }, [amount, email, amountAmount, emailState.isTouched, message])

  return (
    <>
      <div className="dark:text-polar-500 space-y-2 p-4 text-sm text-gray-500">
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <DonationAmount />
            <Email />
            <Message />

            {polarPaymentIntent ? (
              <StripeForm
                isSyncing={isSyncing}
                polarPaymentIntent={polarPaymentIntent}
              />
            ) : (
              <div className="flex flex-col space-y-4">
                {isSyncing ? (
                  <>
                    <Skeleton className="h-[40px] w-full" />
                    <Skeleton className="h-[40px] w-full" />
                  </>
                ) : null}

                <Button size="lg" disabled={true} fullWidth>
                  Donate
                </Button>
              </div>
            )}
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
              <div className="w-full">
                <MoneyInput
                  id={'amount-amount'}
                  name={'amount-amount'}
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
                Email
              </FormLabel>
              <FormMessage />
            </div>
            <FormControl>
              <div className="w-full">
                <Input {...field} placeholder="you@example.com" />
              </div>
            </FormControl>
          </FormItem>
        )}
      />
    </>
  )
}

const Message = () => {
  const { control } = useFormContext<DonationCreateStripePaymentIntent>()

  return (
    <>
      <FormField
        control={control}
        name="message"
        rules={{
          maxLength: 240,
        }}
        render={({ field }) => (
          <FormItem className="flex flex-col items-start justify-between">
            <div className="flex flex-col gap-y-2">
              <FormLabel className="dark:text-polar-50 text-gray-950">
                Message
              </FormLabel>
              <FormMessage />
            </div>
            <FormControl>
              <div className="w-full">
                <Textarea
                  {...field}
                  placeholder="Include a personal message"
                ></Textarea>
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

  const [paymentMethod, setPaymentMethod] = useState<
    PaymentMethod | undefined
  >()

  if (!stripePromise) {
    return (
      <>
        <Skeleton className="h-[40px] w-full" />
        <Skeleton className="h-[40px] w-full" />
      </>
    )
  }

  return (
    <>
      <SelectPaymentMethod
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
      />

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

const SelectPaymentMethod = ({
  paymentMethod,
  setPaymentMethod,
}: {
  paymentMethod?: PaymentMethod
  setPaymentMethod: (_?: PaymentMethod) => void
}) => {
  const savedPaymentMethods = useListPaymentMethods()

  const onPaymentMethodChange = (id: string) => {
    const pm = savedPaymentMethods.data?.items?.find(
      (p) => p.stripe_payment_method_id === id,
    )
    setPaymentMethod(pm)
  }

  if (
    !savedPaymentMethods ||
    !savedPaymentMethods.data ||
    !savedPaymentMethods.data.items ||
    savedPaymentMethods.data.items.length === 0
  ) {
    return <></>
  }

  return (
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
  )
}
