'use client'

import {
  useCustomerPortalSessionAuthenticate,
  useCustomerPortalSessionSelect,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

interface CustomerSummary {
  id: string
  name: string | null
  email: string
}

interface CustomerSelectionData {
  selection_token: string
  email: string
  organization_id: string
  available_customers: CustomerSummary[]
}

interface AuthenticateResponse {
  token?: string
  customer_id?: string
  member_id?: string
  requires_customer_selection?: boolean
  selection_token?: string
  email?: string
  organization_id?: string
  available_customers?: CustomerSummary[]
}

const CustomerPicker = ({
  organization,
  selectionData,
  onBack,
}: {
  organization: schemas['CustomerOrganization']
  selectionData: CustomerSelectionData
  onBack: () => void
}) => {
  const router = useRouter()
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const selectMutation = useCustomerPortalSessionSelect(api)

  const handleSelect = useCallback(
    async (customerId: string) => {
      setSelectedCustomerId(customerId)
      setError(null)

      const { data, error: selectError } = await selectMutation.mutateAsync({
        selection_token: selectionData.selection_token,
        customer_id: customerId,
        email: selectionData.email,
        organization_id: selectionData.organization_id,
      })

      if (selectError || !data) {
        setError('Failed to select account. Please try again.')
        setSelectedCustomerId(null)
        return
      }

      router.push(
        `/${organization.slug}/portal/?customer_session_token=${data.token}`,
      )
    },
    [selectMutation, selectionData, router, organization],
  )

  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <div className="flex w-full flex-col gap-y-6 md:max-w-md">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl text-black dark:text-white">
            Select an account
          </h2>
          <p className="dark:text-polar-500 text-gray-500">
            You have access to multiple accounts. Select which one you&apos;d
            like to access.
          </p>
        </div>

        {error && (
          <p className="text-sm font-medium text-red-500 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {selectionData.available_customers.map((customer) => (
            <button
              key={customer.id}
              onClick={() => handleSelect(customer.id)}
              disabled={selectMutation.isPending}
              className="dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 flex w-full flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium text-black dark:text-white">
                {customer.name || 'Unnamed Account'}
              </span>
              <span className="dark:text-polar-400 text-sm text-gray-500">
                {customer.email}
              </span>
              {selectedCustomerId === customer.id &&
                selectMutation.isPending && (
                  <span className="dark:text-polar-400 mt-1 text-xs text-gray-400">
                    Logging in...
                  </span>
                )}
            </button>
          ))}
        </div>

        <p className="dark:text-polar-400 text-center text-sm text-gray-500">
          <button
            onClick={onBack}
            className="underline hover:no-underline"
            disabled={selectMutation.isPending}
          >
            Use a different email
          </button>
        </p>
      </div>
    </ShadowBox>
  )
}

const ClientPage = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const router = useRouter()
  const form = useForm<{ code: string }>()
  const { control, handleSubmit, setError, reset } = form
  const sessionRequest = useCustomerPortalSessionAuthenticate(api)
  const [customerSelectionData, setCustomerSelectionData] =
    useState<CustomerSelectionData | null>(null)

  const code = useWatch({ control, name: 'code', defaultValue: '' })

  const onSubmit = useCallback(
    async ({ code }: { code: string }) => {
      const { data, error } = await sessionRequest.mutateAsync({ code })

      if (error && error?.detail) {
        if (typeof error.detail === 'string') {
          setError('root', { message: error.detail })
        } else {
          setValidationErrors(error.detail, setError)
        }
        return
      }

      if (!data) {
        setError('root', { message: 'Invalid verification code' })
        return
      }

      // Cast to extended response type (includes new member authentication fields)
      const authData = data as AuthenticateResponse

      // Check if customer selection is required (member has access to multiple customers)
      if (
        authData.requires_customer_selection &&
        authData.selection_token &&
        authData.email &&
        authData.organization_id &&
        authData.available_customers
      ) {
        setCustomerSelectionData({
          selection_token: authData.selection_token,
          email: authData.email,
          organization_id: authData.organization_id,
          available_customers: authData.available_customers,
        })
        return
      }

      // Direct authentication success
      if (authData.token) {
        router.push(
          `/${organization.slug}/portal/?customer_session_token=${authData.token}`,
        )
      }
    },
    [sessionRequest, setError, router, organization],
  )

  const handleBackFromSelection = useCallback(() => {
    setCustomerSelectionData(null)
    reset()
    router.push(`/${organization.slug}/portal/request`)
  }, [reset, router, organization])

  // Show customer picker if selection is required
  if (customerSelectionData) {
    return (
      <CustomerPicker
        organization={organization}
        selectionData={customerSelectionData}
        onBack={handleBackFromSelection}
      />
    )
  }

  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <div className="flex w-full flex-col gap-y-6 md:max-w-sm">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl text-black dark:text-white">
            Verification code
          </h2>
          <p className="dark:text-polar-500 text-gray-500">
            Enter the verification code sent to your email address.
          </p>
        </div>
        <Form {...form}>
          <form
            className="flex w-full flex-col items-center gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <FormField
              control={control}
              name="code"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormControl>
                      <InputOTP
                        maxLength={6}
                        pattern="^[a-zA-Z0-9]+$"
                        inputMode="text"
                        {...field}
                        onChange={(value) =>
                          field.onChange(value.toUpperCase())
                        }
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="dark:border-polar-600 h-12 w-12 border-gray-300 text-xl md:h-16 md:w-16 md:text-2xl"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            {form.formState.errors.root && (
              <p className="text-sm font-medium text-red-500 dark:text-red-400">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={sessionRequest.isPending}
              disabled={sessionRequest.isPending || code.length !== 6}
            >
              Access my purchases
            </Button>

            <p className="dark:text-polar-400 text-sm text-gray-500">
              Don&apos;t have a code?{' '}
              <Link href="request" className="underline hover:no-underline">
                Request a new one
              </Link>
              .
            </p>
          </form>
        </Form>
      </div>
    </ShadowBox>
  )
}

export default ClientPage
