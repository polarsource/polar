'use client'

import { useAuthSessionStart, useEmailOTPRequest } from '@/hooks'
import { usePostHog, type EventName } from '@/hooks/posthog'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

interface EmailOTPFormProps {
  authenticationSession: schemas['AuthenticationSession'] | null
  returnTo?: string
  signup?: boolean
}

const EmailOTPForm = ({
  authenticationSession,
  returnTo,
  signup,
}: EmailOTPFormProps) => {
  const form = useForm<{ email: string }>({
    defaultValues: {
      email: '',
    },
  })
  const { control, handleSubmit, setError } = form
  const [loading, setLoading] = useState(false)
  const authSessionStart = useAuthSessionStart()
  const emailOTPRequest = useEmailOTPRequest()
  const posthog = usePostHog()
  const router = useRouter()

  const onSubmit: SubmitHandler<{ email: string }> = async ({ email }) => {
    setLoading(true)
    try {
      let eventName: EventName = 'global:user:login:submit'
      if (signup) {
        eventName = 'global:user:signup:submit'
      }

      posthog.capture(eventName, {
        method: 'email_otp',
      })

      if (!authenticationSession) {
        await authSessionStart.mutateAsync(returnTo)
      }

      const { error } = await emailOTPRequest.mutateAsync(email)
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else if (error.detail) {
          setError('email', { message: error.detail })
        }
        return
      }

      const urlSearchParams = new URLSearchParams({
        email,
        intent: signup ? 'signup' : 'login',
      })
      router.push(`/auth/email-otp?${urlSearchParams.toString()}`)
    } catch {
      setError('email', {
        message: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form className="flex w-full flex-col" onSubmit={handleSubmit(onSubmit)}>
        <FormField
          control={control}
          name="email"
          render={({ field }) => {
            return (
              <FormItem>
                <FormControl className="w-full">
                  <div className="flex w-full flex-col gap-2">
                    <Input
                      type="email"
                      required
                      placeholder="Email"
                      autoComplete="off"
                      data-1p-ignore
                      {...field}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      fullWidth
                      loading={loading}
                      disabled={loading}
                    >
                      {signup ? 'Sign up with email' : 'Sign in with email'}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      </form>
    </Form>
  )
}

export default EmailOTPForm
