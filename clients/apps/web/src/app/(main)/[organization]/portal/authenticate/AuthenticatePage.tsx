'use client'

import { useCustomerPortalSessionAuthenticate } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'
import { Box } from '@polar-sh/orbit/Box'
import { PortalText } from '@/components/CustomerPortal/PortalPrimitives'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { PortalAuthHeader, PortalAuthShell } from '../PortalShell'

const ClientPage = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const router = useRouter()
  const form = useForm<{ code: string }>()
  const { control, handleSubmit, setError } = form
  const sessionRequest = useCustomerPortalSessionAuthenticate(api)

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

      // Invalidate cached queries before redirect to ensure fresh data
      const queryClient = getQueryClient()
      queryClient.invalidateQueries({ queryKey: ['portal_authenticated_user'] })
      queryClient.invalidateQueries({ queryKey: ['customer_portal_session'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })

      router.push(
        `/${organization.slug}/portal/?customer_session_token=${data.token}`,
      )
    },
    [sessionRequest, setError, router, organization],
  )

  return (
    <PortalAuthShell organization={organization}>
      <Box flexDirection="column" rowGap="xl">
        <PortalAuthHeader
          title="Check your email"
          description="Enter the verification code we sent to your email address."
        />
        <Form {...form}>
          <form
            className="flex w-full flex-col gap-y-6"
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
                        autoComplete="one-time-code"
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
                              className="h-12 w-12 text-xl md:h-14 md:w-14"
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
              <PortalText tone="danger" className="text-sm">
                {form.formState.errors.root.message}
              </PortalText>
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

            <PortalText tone="secondary" className="text-sm">
              Didn&apos;t get a code?{' '}
              <Link href="request" className="underline hover:no-underline">
                Request a new one
              </Link>
            </PortalText>
          </form>
        </Form>
      </Box>
    </PortalAuthShell>
  )
}

export default ClientPage
