'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCreditCustomerMeter } from '@/hooks/queries/customerMeters'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import {
  Button,
  Checkbox,
  InlineModalHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { AddCreditsSummary } from './AddCreditsSummary'
import {
  formatCredits,
  parseCreditUnits,
  validateCreditUnits,
} from './creditPreview'
import { useMeterCreditOptions } from './useMeterCreditOptions'

interface AddCreditsForm {
  meter_id: string
  units: string
  rollover: boolean
}

export const AddCreditsModal = ({
  organization,
  customer,
  meterId,
  onClose,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meterId?: string
  onClose: () => void
}) => {
  const [externalId] = useState(() => crypto.randomUUID())
  const { options, isLoading } = useMeterCreditOptions(
    organization.id,
    customer,
  )
  const creditCustomerMeter = useCreditCustomerMeter()
  const form = useForm<AddCreditsForm>({
    mode: 'onChange',
    defaultValues: { meter_id: meterId ?? '', units: '', rollover: true },
  })

  const values = useWatch({ control: form.control })
  const option = options.find((o) => o.meter.id === values.meter_id)
  const units = parseCreditUnits(values.units ?? '')
  const customerLabel = customer.name || customer.email || 'this customer'

  const onSubmit = async (submitted: AddCreditsForm) => {
    const submittedUnits = parseCreditUnits(submitted.units)
    if (!option || !submittedUnits) return

    const { error } = await creditCustomerMeter.mutateAsync({
      customer_id: customer.id,
      meter_id: option.meter.id,
      units: submittedUnits,
      rollover: submitted.rollover,
      external_id: externalId,
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, form.setError)
        return
      }
      const alreadyAdded =
        'error' in error &&
        error.error === 'CustomerMeterCreditExternalIDConflict'
      toast({
        title: 'Credits Not Added',
        description: alreadyAdded
          ? 'These credits may already have been added. Refresh the page to check the balance.'
          : extractApiErrorMessage(error),
      })
      return
    }

    toast({
      title: 'Credits Added',
      description: `Added ${formatCredits(submittedUnits)} on ${option.meter.name} for ${customerLabel}. The balance will update shortly.`,
    })
    onClose()
  }

  return (
    <Box flexDirection="column" overflowY="auto">
      <InlineModalHeader hide={onClose}>
        <Text variant="heading-xs" as="h2">
          Add credits
        </Text>
      </InlineModalHeader>
      <Form {...form}>
        <Box
          as="form"
          onSubmit={form.handleSubmit(onSubmit)}
          flexDirection="column"
          rowGap="xl"
          paddingHorizontal="2xl"
          paddingBottom="3xl"
        >
          <FormField
            control={form.control}
            name="meter_id"
            rules={{ required: 'Select a meter' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meter</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue
                        placeholder={
                          isLoading ? 'Loading meters…' : 'Select a meter'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map(({ meter, productName }) => (
                      <SelectItem key={meter.id} value={meter.id}>
                        {meter.name}
                        {productName && ` · ${productName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <Box flexDirection="column" rowGap="m">
            <FormField
              control={form.control}
              name="units"
              rules={{ validate: validateCreditUnits }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credits</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus={!!meterId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rollover"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Checkbox
                      label="Rollover unused credits to the next billing cycle"
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </Box>
          {(option || (isLoading && meterId)) && (
            <AddCreditsSummary option={option} units={units ?? 0} />
          )}
          <Box flexDirection="column" rowGap="l">
            <Text color="muted">
              Grant{' '}
              <Text as="span" color="default">
                {formatCredits(units ?? 0)}
              </Text>{' '}
              to{' '}
              <Text as="span" color="default">
                {customerLabel}
              </Text>
              .{' '}
              {values.rollover
                ? "Credits don't expire"
                : 'Unused credits expire at the end of the billing period'}{' '}
              and can&apos;t be removed once added.
            </Text>
            <Box columnGap="s" justifyContent="end">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!option || !units}
                loading={creditCustomerMeter.isPending}
              >
                Add credits
              </Button>
            </Box>
          </Box>
        </Box>
      </Form>
    </Box>
  )
}
