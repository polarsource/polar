'use client'

import { useSendEmailUpdate } from '@/hooks/emailUpdate'
import { setValidationErrors } from '@/utils/api/errors'
import { FormControl } from '@mui/material'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Form, FormField, FormItem } from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

interface EmailUpdateformProps {
  returnTo?: string
  onEmailUpdateRequest?: () => void
  onCancel?: () => void
}

const EmailUpdateForm: React.FC<EmailUpdateformProps> = ({
  returnTo,
  onEmailUpdateRequest,
  onCancel,
}) => {
  const form = useForm<{ email: string }>()
  const { control, handleSubmit, setError } = form
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const sendEmailUpdate = useSendEmailUpdate()

  const onSubmit: SubmitHandler<{ email: string }> = async ({ email }) => {
    setErrorMessage(null) // Clear previous errors
    setLoading(true)
    const { error } = await sendEmailUpdate(email, returnTo)
    setLoading(false)
    if (error) {
      let errMsg = 'An error occurred while updating your email.'
      if (error.detail && Array.isArray(error.detail)) {
        const emailError = error.detail.find(
          (err) => Array.isArray(err.loc) && err.loc.includes('email'),
        )
        if (emailError?.msg) {
          errMsg = emailError.msg
        }
        setValidationErrors(error.detail, setError)
      }
      setErrorMessage(errMsg)
      return
    }
    onEmailUpdateRequest?.()
  }

  return (
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
                <FormControl className="w-full">
                  <div className="flex w-full flex-row gap-2">
                    <Input
                      type="email"
                      required
                      placeholder="New email"
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
                      Update
                    </Button>
                    {onCancel && (
                      <Button
                        type="button"
                        size="lg"
                        variant="ghost"
                        onClick={onCancel}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </FormControl>
              </FormItem>
            )
          }}
        />
        {errorMessage && (
          <div className="text-sm text-red-700 dark:text-red-500">
            {errorMessage}
          </div>
        )}
      </form>
    </Form>
  )
}

export default EmailUpdateForm
