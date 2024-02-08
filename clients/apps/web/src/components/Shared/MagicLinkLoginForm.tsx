'use client'

import { FormControl } from '@mui/material'
import { ResponseError, ValidationError } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { setValidationErrors } from 'polarkit/api/errors'
import { Button, Input } from 'polarkit/components/ui/atoms'
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

interface MagicLinkLoginFormProps {
  returnTo?: string
}

const MagicLinkLoginForm: React.FC<MagicLinkLoginFormProps> = ({
  returnTo,
}) => {
  const form = useForm<{ email: string }>()
  const { control, handleSubmit, setError } = form
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onSubmit: SubmitHandler<{ email: string }> = async ({ email }) => {
    setLoading(true)
    try {
      await api.magicLink.magicLinkRequest({
        magicLinkRequest: { email, return_to: returnTo },
      })
      const searchParams = new URLSearchParams({ email })
      router.push(`/login/magic-link/request?${searchParams}`)
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
                  <Input
                    type="email"
                    required
                    placeholder="Email"
                    autoComplete="off"
                    data-1p-ignore
                    {...field}
                  />
                  <div className="absolute inset-y-0 right-0 z-50 flex items-center pr-2">
                    <Button
                      type="submit"
                      size="sm"
                      loading={loading}
                      disabled={loading}
                    >
                      Sign in
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
