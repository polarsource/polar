'use client'

import { useEmailOTPVerify } from '@/hooks'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import { isValidationError } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'
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

const VerifyPage = ({ intent = 'login' }: { intent?: 'login' | 'signup' }) => {
  const form = useForm<{ code: string }>()
  const { control, handleSubmit, setError } = form
  const emailOTPVerify = useEmailOTPVerify()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const onSubmit: SubmitHandler<{ code: string }> = async ({ code }) => {
    setLoading(true)
    const { error } = await emailOTPVerify.mutateAsync(code)
    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else if (error.detail) {
        setError('code', { message: error.detail })
      }
      setLoading(false)
      return
    }
    router.push('/auth')
  }

  return (
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
                    autoComplete="one-time-code"
                    {...field}
                    autoFocus={true}
                    onChange={(value) => field.onChange(value.toUpperCase())}
                    onComplete={handleSubmit(onSubmit)}
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
                <FormMessage className="text-center" />
              </FormItem>
            )
          }}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {intent === 'signup' ? 'Sign up' : 'Sign in'}
          {CONFIG.IS_SANDBOX && ' to Sandbox'}
        </Button>
      </form>
    </Form>
  )
}

export default VerifyPage
