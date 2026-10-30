'use client'

import { useCustomerPortalSessionRequest } from '@/hooks/queries/customerPortal'
import { TURNSTILE_SCRIPT_URL, useTurnstile } from '@/hooks/useTurnstile'
import { setValidationErrors } from '@/utils/api/errors'
import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useRouter } from 'next/navigation'
import Script from 'next/script'

import { api } from '@/utils/client'
import { isValidationError, schemas } from '@polar-sh/client'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

interface CustomerSelectionOption {
  id: string
  name: string | null
}

interface CustomerSelectionRequiredResponse {
  customers: CustomerSelectionOption[]
}

const TURNSTILE_ACTION = 'customer-portal-otp'

const ClientPage = ({
  organization,
  email,
}: {
  organization: schemas['CustomerOrganization']
  email?: string
}) => {
  const router = useRouter()
  const form = useForm<{ email: string }>({
    defaultValues: {
      email: email || '',
    },
  })
  const { control, handleSubmit, setError, getValues } = form
  const sessionRequest = useCustomerPortalSessionRequest(api, organization.id)
  const {
    containerRef: turnstileContainerRef,
    render: renderTurnstile,
    execute: executeTurnstile,
    getToken: getTurnstileToken,
    reset: resetTurnstile,
  } = useTurnstile(TURNSTILE_ACTION)

  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<CustomerSelectionOption[]>([])
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  const onSubmit = useCallback(
    async ({ email }: { email: string }, customerId?: string) => {
      setLoading(true)
      try {
        const turnstileToken = await getTurnstileToken()
        if (!turnstileToken) {
          setShowCustomerPicker(false)
          setError('email', {
            message: 'Verification failed. Please try again.',
          })
          return
        }

        const response = await sessionRequest.mutateAsync({
          email,
          customer_id: customerId,
          turnstileToken,
        })

        // Handle 409 - customer selection required
        if (response.response.status === 409) {
          const data =
            response.error as unknown as CustomerSelectionRequiredResponse
          if (data.customers && data.customers.length > 0) {
            setCustomers(data.customers)
            setShowCustomerPicker(true)
            return
          }
        }

        if (response.error) {
          setShowCustomerPicker(false)
          if (isValidationError(response.error.detail)) {
            setValidationErrors(response.error.detail, setError)
          } else if (response.error.detail) {
            setError('email', { message: response.error.detail })
          }
          return
        }
        router.push(`/${organization.slug}/portal/authenticate`)
      } catch {
        setShowCustomerPicker(false)
        setError('email', {
          message: 'An unexpected error occurred. Please try again.',
        })
      } finally {
        resetTurnstile()
        setLoading(false)
      }
    },
    [
      getTurnstileToken,
      resetTurnstile,
      sessionRequest,
      setError,
      router,
      organization,
    ],
  )

  const handleCustomerSelect = useCallback(async () => {
    if (!selectedCustomerId) return
    const email = getValues('email')
    await onSubmit({ email }, selectedCustomerId)
  }, [selectedCustomerId, getValues, onSubmit])

  // The Turnstile container sits outside both views so the widget survives
  // the switch to the customer picker, which requests a second token.
  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <Script
        src={TURNSTILE_SCRIPT_URL}
        strategy="afterInteractive"
        onLoad={renderTurnstile}
        onReady={renderTurnstile}
      />
      <div className="flex w-full flex-col gap-y-6 md:max-w-sm">
        {showCustomerPicker ? (
          <>
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl text-black dark:text-white">
                Select an account
              </h2>
              <p className="dark:text-polar-400 text-gray-500">
                Multiple accounts are associated with this email. Please select
                the account you want to access.
              </p>
            </div>
            <RadioGroup
              value={selectedCustomerId}
              onValueChange={setSelectedCustomerId}
              className="flex flex-col gap-3"
            >
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="dark:hover:bg-polar-800 flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50"
                >
                  <RadioGroupItem value={customer.id} id={customer.id} />
                  <Label
                    htmlFor={customer.id}
                    className="flex-1 cursor-pointer font-medium"
                  >
                    {customer.name || 'Unnamed account'}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setShowCustomerPicker(false)
                  setSelectedCustomerId('')
                  setCustomers([])
                }}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1"
                loading={loading}
                disabled={loading || !selectedCustomerId}
                onClick={handleCustomerSelect}
              >
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl text-black dark:text-white">Sign in</h2>
              <p className="dark:text-polar-400 text-gray-500">
                Enter your email address to access your purchases. A
                verification code will be sent to you.
              </p>
            </div>
            <Form {...form}>
              <form
                className="flex w-full flex-col gap-y-6"
                onSubmit={handleSubmit((data) => onSubmit(data))}
              >
                <FormField
                  control={control}
                  name="email"
                  rules={{
                    required: 'This field is required',
                  }}
                  render={({ field }) => {
                    return (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="email"
                            required
                            placeholder="Email address"
                            autoComplete="email"
                            className="bg-white shadow-xs"
                            {...field}
                            onFocus={executeTurnstile}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  disabled={loading}
                >
                  Access my purchases
                </Button>
              </form>
            </Form>
          </>
        )}
        <div ref={turnstileContainerRef} />
      </div>
    </ShadowBox>
  )
}

export default ClientPage
