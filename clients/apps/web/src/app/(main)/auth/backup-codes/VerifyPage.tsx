'use client'

import { useBackupCodesVerify } from '@/hooks'
import { setValidationErrors } from '@/utils/api/errors'
import { isApiSameOrigin } from '@/utils/auth'
import { CONFIG } from '@/utils/config'
import { isValidationError } from '@polar-sh/client'
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
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

const VerifyPage = () => {
  const form = useForm<{ code: string }>()
  const { control, handleSubmit, setError } = form
  const backupCodesVerify = useBackupCodesVerify()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const onSubmit: SubmitHandler<{ code: string }> = async ({ code }) => {
    setLoading(true)
    try {
      const { error } = await backupCodesVerify.mutateAsync({ code })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else if (error.detail) {
          setError('code', { message: error.detail })
        }
        return
      }
      // Same-origin needs a hard navigation
      if (isApiSameOrigin()) {
        window.location.assign('/auth')
      } else {
        router.push('/auth')
      }
    } catch {
      setError('code', {
        message: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setLoading(false)
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
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Backup code"
                    autoComplete="one-time-code"
                    className="text-center"
                    {...field}
                    autoFocus={true}
                  />
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
      </form>
    </Form>
  )
}

export default VerifyPage
