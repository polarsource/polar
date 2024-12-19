'use client'

import { useCustomerPortalSessionRequest } from '@/hooks/queries'
import { api } from '@/utils/api'
import { setValidationErrors } from '@/utils/api/errors'
import { Organization, ResponseError, ValidationError } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const router = useRouter()
  const form = useForm<{ email: string }>()
  const { control, handleSubmit, setError } = form
  const sessionRequest = useCustomerPortalSessionRequest(api, organization.id)

  const onSubmit = useCallback(
    async ({ email }: { email: string }) => {
      try {
        await sessionRequest.mutateAsync({ email })
        router.push(`/${organization.slug}/portal/authenticate`)
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          }
        }
      }
    },
    [sessionRequest, setError, router, organization],
  )

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
            onSubmit={handleSubmit(onSubmit)}
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
      </div>
    </ShadowBox>
  )
}

export default ClientPage
