'use client'

import { useCustomerPortalSessionRequest } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useCallback, useState } from 'react'
import { PortalAuthHeader, PortalAuthShell } from '../PortalShell'
import { useForm } from 'react-hook-form'

interface CustomerSelectionOption {
  id: string
  name: string | null
}

interface CustomerSelectionRequiredResponse {
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
        const data =
          response.error as unknown as CustomerSelectionRequiredResponse
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
      <PortalAuthShell organization={organization}>
        <Box flexDirection="column" rowGap="xl">
          <PortalAuthHeader
            title="Select an account"
            description="Multiple accounts are associated with this email. Select the account you want to access."
          />
          <RadioGroup
            value={selectedCustomerId}
            onValueChange={setSelectedCustomerId}
            className="flex flex-col gap-3"
          >
            {customers.map((customer) => (
              <Box
                as="label"
                key={customer.id}
                htmlFor={customer.id}
                display="flex"
                alignItems="center"
                columnGap="m"
                padding="l"
                borderRadius="l"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
                backgroundColor={{
                  base: 'background-primary',
                  hover: 'background-secondary',
                }}
                cursor="pointer"
                transitionProperty="colors"
                transitionDuration="fast"
              >
                <RadioGroupItem value={customer.id} id={customer.id} />
                <Box as="span" flex={1} color="text-primary">
                  {customer.name || 'Unnamed account'}
                </Box>
              </Box>
            ))}
          </RadioGroup>
          <Box columnGap="s">
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
          </Box>
        </Box>
      </PortalAuthShell>
    )
  }

  return (
    <PortalAuthShell organization={organization}>
      <Box flexDirection="column" rowGap="xl">
        <PortalAuthHeader
          title="Sign in"
          description="Enter your email address to access your purchases. We'll send you a verification code."
        />
        <Form {...form}>
          <form
            className="flex w-full flex-col gap-y-4"
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
      </Box>
    </PortalAuthShell>
  )
}

export default ClientPage
