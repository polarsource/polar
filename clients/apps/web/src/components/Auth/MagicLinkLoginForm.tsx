'use client'

import { useSendMagicLink } from '@/hooks/magicLink'
import { setValidationErrors } from '@/utils/api/errors'
import { FormControl } from '@mui/material'
import { ResponseError, ValidationError } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
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
  const sendMagicLink = useSendMagicLink()

  const onSubmit: SubmitHandler<{ email: string }> = async ({ email }) => {
    setLoading(true)
    try {
      sendMagicLink(email, returnTo)
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
                  <div className="flex w-full flex-row items-center gap-2">
                    <Input
                      type="email"
                      required
                      placeholder="Email"
                      autoComplete="off"
                      data-1p-ignore
                      {...field}
                    />
                    <Button type="submit" loading={loading} disabled={loading}>
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
