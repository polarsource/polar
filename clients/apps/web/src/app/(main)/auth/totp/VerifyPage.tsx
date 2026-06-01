'use client'

import Link from 'next/link'
import { useTOTPVerify } from '@/hooks'
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
import { useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

const VerifyPage = () => {
  const form = useForm<{ code: string }>()
  const { control, handleSubmit, setError } = form
  const totpVerify = useTOTPVerify()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)
  const onSubmit: SubmitHandler<{ code: string }> = async ({ code }) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    try {
      const { error } = await totpVerify.mutateAsync(code)
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else if (error.detail) {
          setError('code', { message: error.detail })
        }
        return
      }
      router.push('/auth')
    } catch {
      setError('code', {
        message: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
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
                    minLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    {...field}
                    autoFocus={true}
                    onChange={field.onChange}
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
          Sign in
          {CONFIG.IS_SANDBOX && ' to Sandbox'}
        </Button>
        <div className="mt-4 text-center">
          <Link
            href="/auth/backup-codes"
            className="dark:text-polar-300 text-sm text-gray-600 hover:underline"
          >
            Use a backup code instead
          </Link>
        </div>
      </form>
    </Form>
  )
}

export default VerifyPage
