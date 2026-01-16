'use client'

import { useCustomerPortalSessionRequest } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useRouter } from 'next/navigation'

import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@polar-sh/ui/components/ui/radio-group'
import { Label } from '@polar-sh/ui/components/ui/label'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

interface CustomerSelectionOption {
  id: string
  name: string | null
}

interface CustomerSelectionRequiredResponse {
  error: string
  detail: string
  customers: CustomerSelectionOption[]
}
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

  const [customers, setCustomers] = useState<CustomerSelectionOption[]>([])
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  const onSubmit = useCallback(
    async ({ email }: { email: string }, customerId?: string) => {
      const response = await sessionRequest.mutateAsync({
        email,
        customer_id: customerId,
      })

      // Handle 409 - customer selection required
      if (response.response.status === 409) {
        const data = response.error as unknown as CustomerSelectionRequiredResponse
        if (data.customers && data.customers.length > 0) {
          setCustomers(data.customers)
          setShowCustomerPicker(true)
          return
        }
      }

      if (response.error) {
        if (response.error.detail && Array.isArray(response.error.detail)) {
          setValidationErrors(response.error.detail, setError)
        }
        return
      }
      router.push(`/${organization.slug}/portal/authenticate`)
    },
    [sessionRequest, setError, router, organization],
  )

  const handleCustomerSelect = useCallback(async () => {
    if (!selectedCustomerId) return
    const email = getValues('email')
    await onSubmit({ email }, selectedCustomerId)
  }, [selectedCustomerId, getValues, onSubmit])

  if (showCustomerPicker) {
    return (
      <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
        <div className="flex w-full flex-col gap-y-6 md:max-w-sm">
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
                className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-polar-800"
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
              loading={sessionRequest.isPending}
              disabled={sessionRequest.isPending || !selectedCustomerId}
              onClick={handleCustomerSelect}
            >
              Continue
            </Button>
          </div>
        </div>
      </ShadowBox>
    )
  }

  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <div className="flex w-full flex-col gap-y-6 md:max-w-sm">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl text-black dark:text-white">Sign in</h2>
          <p className="dark:text-polar-400 text-gray-500">
            Enter your email address to access your purchases. A verification
            code will be sent to you.
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
              loading={sessionRequest.isPending}
              disabled={sessionRequest.isPending}
            >
              Access my purchases
            </Button>
          </form>
        </Form>
      </div>
    </ShadowBox>
  )
}

export default ClientPage
