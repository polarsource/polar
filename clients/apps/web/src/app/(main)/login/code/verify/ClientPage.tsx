'use client'

import { setValidationErrors } from '@/utils/api/errors'
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
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

const ClientPage = ({ returnTo }: { returnTo?: string }) => {
  const form = useForm<{ code: string }>()
  const { control, handleSubmit, setError } = form

  const onSubmit = useCallback(
    async ({ code }: { code: string }) => {
      // Create a form and submit it to authenticate-form endpoint
      const formElement = document.createElement('form')
      formElement.method = 'POST'
      formElement.action = '/v1/login-code/authenticate'
      
      const codeInput = document.createElement('input')
      codeInput.type = 'hidden'
      codeInput.name = 'code'
      codeInput.value = code
      
      formElement.appendChild(codeInput)
      
      if (returnTo) {
        const returnToInput = document.createElement('input')
        returnToInput.type = 'hidden'
        returnToInput.name = 'return_to'
        returnToInput.value = returnTo
        formElement.appendChild(returnToInput)
      }
      
      document.body.appendChild(formElement)
      formElement.submit()
    },
    [returnTo],
  )

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
                    {...field}
                    onChange={(value) =>
                      field.onChange(value.toUpperCase())
                    }
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
        <Button
          type="submit"
          size="lg"
          className="w-full"
        >
          Sign in
        </Button>
      </form>
    </Form>
  )
}

export default ClientPage