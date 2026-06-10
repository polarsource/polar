'use client'

import { useTranslations } from '@/components/CustomerPortal/PortalLocaleProvider'
import { useCustomerEmailUpdateRequest } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import type { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

interface ChangeEmailFormProps {
  customer: schemas['CustomerPortalCustomer']
}

const ChangeEmailForm = ({ customer }: ChangeEmailFormProps) => {
  const t = useTranslations()
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
            {t('portal.settings.changeEmail.verificationSentPrefix')}{' '}
            <strong className="font-medium">{successEmail}</strong>
            {t('portal.settings.changeEmail.verificationSentSuffix')}
          </p>
          <p className="dark:text-polar-500 text-xs text-gray-500">
            {t('portal.settings.changeEmail.verificationSentHint')}
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
            {t('portal.settings.changeEmail.currentEmail')}
          </p>
          <p className="text-sm">{customer.email}</p>
        </div>
        <div className="flex flex-col gap-y-2">
          <label
            htmlFor="new-email"
            className="dark:text-polar-500 text-sm text-gray-500"
          >
            {t('portal.settings.changeEmail.newEmail')}
          </label>
          <Input
            id="new-email"
            type="email"
            placeholder={t('portal.settings.changeEmail.newEmailPlaceholder')}
            {...register('email', {
              required: t('portal.settings.changeEmail.emailRequired'),
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
            {t('portal.settings.changeEmail.sendVerification')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsEditing(false)
              reset()
            }}
          >
            {t('portal.settings.changeEmail.nevermind')}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex w-full flex-row justify-between gap-x-4">
      <div className="flex flex-col gap-y-1">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {t('portal.settings.changeEmail.currentEmail')}
        </p>
        <p className="text-sm">{customer.email}</p>
      </div>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsEditing(true)}
        >
          {t('portal.settings.changeEmail.requestChange')}
        </Button>
      </div>
    </div>
  )
}

export default ChangeEmailForm
