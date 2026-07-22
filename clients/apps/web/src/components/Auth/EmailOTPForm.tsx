'use client'

import { useAuthSessionStart, useEmailOTPRequest } from '@/hooks'
import { usePostHog, type EventName } from '@/hooks/posthog'
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
import { useCallback, useEffect, useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

interface EmailOTPFormProps {
  authenticationSession: schemas['AuthenticationSession'] | null
  returnTo?: string
  signup?: boolean
}

interface TurnstileWindow extends Window {
  turnstile?: {
    remove: (widgetId: string) => void
    render: (
      container: HTMLElement,
      options: { sitekey: string; action: string },
    ) => string
    reset: (widgetId: string) => void
  }
}

const TURNSTILE_SITE_KEY = '0x4AAAAAAD7cBrbpX3kX8K9g'
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
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetIdRef = useRef<string | null>(null)
  const authSessionStart = useAuthSessionStart()
  const emailOTPRequest = useEmailOTPRequest()
  const posthog = usePostHog()
  const router = useRouter()

  const renderTurnstile = useCallback(() => {
    const turnstile = (window as TurnstileWindow).turnstile
    const container = turnstileContainerRef.current
    if (!turnstile || !container || turnstileWidgetIdRef.current) {
      return
    }

    turnstileWidgetIdRef.current = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      action: TURNSTILE_ACTION,
    })
  }, [])

  useEffect(() => {
    renderTurnstile()

    return () => {
      const turnstile = (window as TurnstileWindow).turnstile
      const widgetId = turnstileWidgetIdRef.current
      if (turnstile && widgetId) {
        turnstile.remove(widgetId)
      }
      turnstileWidgetIdRef.current = null
    }
  }, [renderTurnstile])

  const onSubmit: SubmitHandler<{ email: string }> = async (
    { email },
    event,
  ) => {
    const formElement = event?.target
    const turnstileToken =
      formElement instanceof HTMLFormElement
        ? new FormData(formElement).get('cf-turnstile-response')
        : null
    if (typeof turnstileToken !== 'string' || !turnstileToken) {
      setError('email', {
        message: 'Please complete the verification challenge.',
      })
      return
    }

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
      const turnstileWindow = window as TurnstileWindow
      const widgetId = turnstileWidgetIdRef.current
      if (widgetId) {
        turnstileWindow.turnstile?.reset(widgetId)
      }
      setLoading(false)
    }
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderTurnstile}
        onReady={renderTurnstile}
      />
      <Form {...form}>
        <form
          className="flex w-full flex-col"
          onSubmit={handleSubmit(onSubmit)}
        >
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
                      <div
                        ref={turnstileContainerRef}
                        className="cf-turnstile"
                        data-sitekey={TURNSTILE_SITE_KEY}
                        data-action={TURNSTILE_ACTION}
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
    </>
  )
}

export default EmailOTPForm
