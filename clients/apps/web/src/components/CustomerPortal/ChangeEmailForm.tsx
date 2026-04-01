'use client'

import { useCustomerEmailUpdateRequest } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import type { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

interface ChangeEmailFormProps {
  customer: schemas['CustomerPortalCustomer']
}

const ChangeEmailForm = ({ customer }: ChangeEmailFormProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)
  const emailUpdateRequest = useCustomerEmailUpdateRequest()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<{ email: string }>({
    defaultValues: { email: '' },
  })

  const onSubmit = useCallback(
    async (data: { email: string }) => {
      try {
        await emailUpdateRequest.mutateAsync(data)
        setSuccessEmail(data.email)
        setIsEditing(false)
        reset()
      } catch (e: unknown) {
        if (
          e != null &&
          typeof e === 'object' &&
          'errors' in e &&
          Array.isArray((e as { errors: unknown }).errors)
        ) {
          setValidationErrors(
            (e as { errors: schemas['ValidationError'][] }).errors,
            setError,
          )
        }
      }
    },
    [emailUpdateRequest, setError, reset],
  )

  if (successEmail) {
    return (
      <div className="flex flex-col gap-y-4">
        <div className="dark:bg-polar-700 space-y-3 rounded-xl bg-gray-200 p-4 text-sm text-balance text-gray-700 dark:text-gray-300">
          <p>
            We sent a verification link to{' '}
            <strong className="font-medium">{successEmail}</strong>. Follow the
            instructions to confirm your new email.
          </p>
          <p className="dark:text-polar-500 text-xs text-gray-500">
            Changed your mind? Simply ignore the email and your current address
            will remain active.
          </p>
        </div>
      </div>
    )
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Current email
          </p>
          <p className="text-sm">{customer.email}</p>
        </div>
        <div className="flex flex-col gap-y-2">
          <label
            htmlFor="new-email"
            className="dark:text-polar-500 text-sm text-gray-500"
          >
            New email
          </label>
          <Input
            id="new-email"
            type="email"
            placeholder="Enter new email address"
            {...register('email', {
              required: 'Email is required',
            })}
          />
          {errors.email && (
            <p className="text-destructive-foreground text-sm">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="flex gap-x-2">
          <Button
            type="submit"
            loading={emailUpdateRequest.isPending}
            disabled={emailUpdateRequest.isPending}
          >
            Send Verification
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsEditing(false)
              reset()
            }}
          >
            Nevermind
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex w-full flex-row justify-between gap-x-4">
      <div className="flex flex-col gap-y-1">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Current email
        </p>
        <p className="text-sm">{customer.email}</p>
      </div>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsEditing(true)}
        >
          Request Email Change
        </Button>
      </div>
    </div>
  )
}

export default ChangeEmailForm
