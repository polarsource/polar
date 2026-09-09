'use client'

import { useAuthSessionStart, useEmailOTPRequest } from '@/hooks'
import { usePostHog, type EventName } from '@/hooks/posthog'
import { TURNSTILE_SCRIPT_URL, useTurnstile } from '@/hooks/useTurnstile'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

interface EmailOTPFormProps {
  authenticationSession: schemas['AuthenticationSession'] | null
  returnTo?: string
  signup?: boolean
}

const TURNSTILE_ACTION = 'turnstile-spin-v2'

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
  const {
    containerRef: turnstileContainerRef,
    render: renderTurnstile,
    getToken: getTurnstileToken,
    reset: resetTurnstile,
  } = useTurnstile(TURNSTILE_ACTION)
  const authSessionStart = useAuthSessionStart()
  const emailOTPRequest = useEmailOTPRequest()
  const posthog = usePostHog()
  const router = useRouter()

  const onSubmit: SubmitHandler<{ email: string }> = async ({ email }) => {
    setLoading(true)
    try {
      const turnstileToken = await getTurnstileToken()
      if (!turnstileToken) {
        setError('email', {
          message: 'Verification failed. Please try again.',
        })
        return
      }

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

      const { error } = await emailOTPRequest.mutateAsync({
        email,
        turnstileToken,
      })
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
      resetTurnstile()
      setLoading(false)
    }
  }

  return (
    <>
      <Script
        src={TURNSTILE_SCRIPT_URL}
        strategy="afterInteractive"
        onLoad={renderTurnstile}
        onReady={renderTurnstile}
      />
      <Form {...form}>
        <form
          className="flex w-full flex-col gap-2"
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormField
            control={control}
            name="email"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      required
                      placeholder="Email"
                      autoComplete="off"
                      data-1p-ignore
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
            variant="secondary"
            fullWidth
            loading={loading}
            disabled={loading}
          >
            {signup ? 'Sign up with email' : 'Sign in with email'}
          </Button>
          <div ref={turnstileContainerRef} />
        </form>
      </Form>
    </>
  )
}

export default EmailOTPForm
