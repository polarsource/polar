'use client'

import { CONFIG } from '@/utils/config'
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
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

const ClientPage = ({ returnTo }: { returnTo?: string }) => {
  const form = useForm<{ code: string }>()
  const { control, setError } = form

  const urlSearchParams = new URLSearchParams({
    ...(returnTo && { returnTo }),
  })

  const [loading, setLoading] = useState(false)
  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    e.currentTarget.submit()
  }, [])

  return (
    <Form {...form}>
      <form
        className="flex w-full flex-col items-center gap-y-6"
        action={`${CONFIG.BASE_URL}/v1/login-code/authenticate?${urlSearchParams.toString()}`}
        method="POST"
        onSubmit={onSubmit}
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
                    {...field}
                    onChange={(value) => field.onChange(value.toUpperCase())}
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
                <FormMessage />
              </FormItem>
            )
          }}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </Form>
  )
}

export default ClientPage
