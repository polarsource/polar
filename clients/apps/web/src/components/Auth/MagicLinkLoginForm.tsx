'use client'

import { useSendMagicLink } from '@/hooks/magicLink'
import { usePostHog, type EventName } from '@/hooks/posthog'
import { setValidationErrors } from '@/utils/api/errors'
import {
  ResponseError,
  UserSignupAttribution,
  ValidationError,
} from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/button'
import Input from '@polar-sh/ui/components/atoms/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

interface MagicLinkLoginFormProps {
  returnTo?: string
  signup?: UserSignupAttribution
}

const MagicLinkLoginForm: React.FC<MagicLinkLoginFormProps> = ({
  returnTo,
  signup,
}) => {
  const form = useForm<{ email: string }>()
  const { control, handleSubmit, setError } = form
  const [loading, setLoading] = useState(false)
  const sendMagicLink = useSendMagicLink()
  const posthog = usePostHog()

  const onSubmit: SubmitHandler<{ email: string }> = async ({ email }) => {
    setLoading(true)
    let eventName: EventName = 'global:user:login:submit'
    if (signup) {
      eventName = 'global:user:signup:submit'
    }

    posthog.capture(eventName, {
      method: 'ml',
    })

    try {
      sendMagicLink(email, returnTo, signup)
    } catch (e) {
      if (e instanceof ResponseError) {
        const body = await e.response.json()
        if (e.response.status === 422) {
          const validationErrors = body['detail'] as ValidationError[]
          setValidationErrors(validationErrors, setError)
        } else if (body['detail']) {
          setError('email', { message: body['detail'] })
        }
      }
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
                  <div className="flex w-full flex-row gap-2">
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
                      size="lg"
                      variant="secondary"
                      loading={loading}
                      disabled={loading}
                    >
                      Login
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

export default MagicLinkLoginForm
