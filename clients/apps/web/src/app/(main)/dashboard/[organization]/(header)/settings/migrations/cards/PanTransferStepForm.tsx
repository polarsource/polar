'use client'

import { useCompletePanTransferStep } from '@/hooks/queries/merchantMigrations'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import {
  StepCopy,
  STRIPE_MIGRATION_ID_FIELD,
  stripeMigrationIdError,
} from './panTransferCopy'

interface Props {
  copy: StepCopy
  migrationId: string
  stepKey: string
}

// The mutation lives here, not in the panel, so a failure stays attached to the
// step that caused it. A shared one keeps showing the last error after a
// refetch moves the checklist on.
export function PanTransferStepForm({ copy, migrationId, stepKey }: Props) {
  const complete = useCompletePanTransferStep(migrationId)
  const [values, setValues] = useState<Record<string, string>>({})
  const fields = copy.inputs ?? []
  const missingRequired = fields.some(
    (field) => field.required && !values[field.name]?.trim(),
  )
  const migrationIdError = stripeMigrationIdError(
    values[STRIPE_MIGRATION_ID_FIELD] ?? '',
  )
  const blocked = missingRequired || migrationIdError !== null

  return (
    <Box
      as="form"
      flexDirection="column"
      rowGap="m"
      onSubmit={(event) => {
        event.preventDefault()
        if (blocked) {
          return
        }
        complete.mutate({ key: stepKey, inputs: values })
      }}
    >
      {fields.map((field) => {
        const fieldError =
          field.name === STRIPE_MIGRATION_ID_FIELD ? migrationIdError : null
        return (
          <Box
            key={field.name}
            flexDirection="column"
            rowGap="xs"
            maxWidth={380}
          >
            <Text
              as="label"
              htmlFor={field.name}
              variant="caption"
              color="muted"
            >
              {field.label}
              {field.required ? '' : ' (optional)'}
            </Text>
            <Input
              id={field.name}
              value={values[field.name] ?? ''}
              placeholder={field.placeholder}
              aria-invalid={fieldError !== null}
              aria-describedby={
                fieldError
                  ? `${field.name}-error`
                  : field.hint
                    ? `${field.name}-hint`
                    : undefined
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
            />
            {fieldError ? (
              <Text
                id={`${field.name}-error`}
                variant="caption"
                color="danger"
                role="alert"
              >
                {fieldError}
              </Text>
            ) : (
              field.hint && (
                <Text id={`${field.name}-hint`} variant="caption" color="muted">
                  {field.hint}
                </Text>
              )
            )}
          </Box>
        )
      })}

      {complete.error && (
        <Text variant="caption" color="danger" role="alert">
          {complete.error.message}
        </Text>
      )}

      <Box>
        <Button
          type="submit"
          size="sm"
          disabled={complete.isPending || blocked}
        >
          {complete.isPending ? 'Saving…' : copy.action}
        </Button>
      </Box>
    </Box>
  )
}
