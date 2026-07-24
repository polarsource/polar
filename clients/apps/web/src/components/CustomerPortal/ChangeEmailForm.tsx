'use client'

import { useCustomerEmailUpdateRequest } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import type { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
      <Box
        flexDirection="column"
        rowGap="m"
        borderRadius="m"
        backgroundColor="background-card"
        padding="l"
      >
        <Text wrap="balance">
          We sent a verification link to{' '}
          <Text as="strong" variant="title">
            {successEmail}
          </Text>
          . Follow the instructions to confirm your new email.
        </Text>
        <Text variant="caption" color="muted">
          Changed your mind? Simply ignore the email and your current address
          will remain active.
        </Text>
      </Box>
    )
  }

  const currentEmail = (
    <Box flexDirection="column" rowGap="xs">
      <Text color="muted">Current email</Text>
      <Text>{customer.email}</Text>
    </Box>
  )

  if (isEditing) {
    return (
      <Box
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        flexDirection="column"
        rowGap="l"
      >
        {currentEmail}
        <Box flexDirection="column" rowGap="s">
          <Text as="label" htmlFor="new-email" color="muted">
            New email
          </Text>
          <Input
            id="new-email"
            type="email"
            placeholder="Enter new email address"
            {...register('email', {
              required: 'Email is required',
            })}
          />
          {errors.email && <Text color="danger">{errors.email.message}</Text>}
        </Box>
        <Box columnGap="s">
          <Button
            type="submit"
            loading={emailUpdateRequest.isPending}
            disabled={emailUpdateRequest.isPending}
          >
            Send verification
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
        </Box>
      </Box>
    )
  }

  return (
    <Box width="100%" justifyContent="between" columnGap="l">
      {currentEmail}
      <Box>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsEditing(true)}
        >
          Request email change
        </Button>
      </Box>
    </Box>
  )
}

export default ChangeEmailForm
