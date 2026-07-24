'use client'

import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import DatePicker from '@polar-sh/ui/components/atoms/DateTimePicker'
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@polar-sh/ui/components/ui/form'
import { useForm } from 'react-hook-form'

interface PauseSubscriptionFormProps {
  currentPeriodEnd: string | null
  isPending: boolean
  onSubmit: (resumesAt: string | null) => void | Promise<void>
}

/**
 * Shared by the merchant dashboard and the customer portal. Presentational on
 * purpose: each surface owns its own mutation, since the two call different
 * endpoints under different credentials.
 */
export const PauseSubscriptionForm = ({
  currentPeriodEnd,
  isPending,
  onSubmit,
}: PauseSubscriptionFormProps) => {
  const form = useForm<{ resumes_at?: string }>({
    defaultValues: { resumes_at: undefined },
  })

  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : undefined

  return (
    <Form {...form}>
      <Box
        as="form"
        onSubmit={form.handleSubmit(({ resumes_at }) =>
          onSubmit(resumes_at || null),
        )}
        flexDirection="column"
        rowGap="xl"
      >
        <FormField
          control={form.control}
          name="resumes_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resume date (optional)</FormLabel>
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                disabled={periodEnd ? { before: periodEnd } : undefined}
              />
              <FormDescription>
                Leave empty to pause indefinitely until you resume it manually.
                Must be after the current period ends.
              </FormDescription>
            </FormItem>
          )}
        />
        <Button type="submit" loading={isPending}>
          Pause Subscription
        </Button>
      </Box>
    </Form>
  )
}
