'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import { toast } from '@/components/Toast/use-toast'
import { useHasPermission } from '@/hooks/permissions'
import { useCreditCustomerMeter } from '@/hooks/queries/customerMeters'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { permissionDeniedMessage } from '@/utils/permissions'
import { isValidationError, schemas } from '@polar-sh/client'
import {
  Button,
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
import { useMeterCreditOptions } from './useMeterCreditOptions'

const MAX_UNITS = 1_000_000_000

interface AddCreditsForm {
  meter_id: string
  units?: number
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
  const canManageCustomers = useHasPermission(
    organization.id,
    'customers:manage',
  )
  const [externalId] = useState(() => crypto.randomUUID())
  const { options, isLoading } = useMeterCreditOptions(
    organization.id,
    customer,
  )
  const creditCustomerMeter = useCreditCustomerMeter()
  const form = useForm<AddCreditsForm>({
    defaultValues: { meter_id: meterId ?? '' },
  })

  const values = useWatch({ control: form.control })
  const option = options.find((o) => o.meter.id === values.meter_id)
  const units =
    values.units !== undefined &&
    Number.isInteger(values.units) &&
    values.units > 0
      ? values.units
      : null

  const onSubmit = async ({ units: submittedUnits }: AddCreditsForm) => {
    if (!option || !submittedUnits) return

    const { error } = await creditCustomerMeter.mutateAsync({
      customer_id: customer.id,
      meter_id: option.meter.id,
      units: submittedUnits,
      rollover: true,
      external_id: externalId,
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, form.setError)
      } else if (
        'error' in error &&
        error.error === 'CustomerMeterCreditExternalIDConflict'
      ) {
        toast({
          title: 'Credits Not Added',
          description:
            'These credits may already have been added. Refresh the page to check the balance.',
        })
      } else {
        toast({
          title: 'Credits Not Added',
          description: extractApiErrorMessage(error),
        })
      }
      return
    }

    toast({
      title: 'Credits Added',
      description: `Added ${submittedUnits.toLocaleString('en-US')} credits on ${option.meter.name} for ${customer.name || customer.email || 'this customer'}.`,
    })
    onClose()
  }

  if (!canManageCustomers) {
    return (
      <Box flexDirection="column" height="100%">
        <InlineModalHeader hide={onClose}>
          <Text variant="heading-xs" as="h2">
            Add credits
          </Text>
        </InlineModalHeader>
        <Box flex={1} flexDirection="column" alignItems="center" padding="xl">
          <AccessRestricted
            message={permissionDeniedMessage('customers:manage')}
          />
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" height="100%">
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
          flex={1}
        >
          <Box
            flexDirection="column"
            rowGap="xl"
            paddingHorizontal="2xl"
            flex={1}
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
                        <SelectValue placeholder="Select a meter" />
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
            <FormField
              control={form.control}
              name="units"
              rules={{
                required: 'Enter an amount',
                min: { value: 1, message: 'Enter at least 1 credit' },
                max: {
                  value: MAX_UNITS,
                  message: 'Enter at most 1,000,000,000 credits',
                },
                validate: (value) =>
                  Number.isInteger(value) || 'Enter a whole number',
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credits</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      max={MAX_UNITS}
                      step={1}
                      placeholder="1000"
                      value={field.value ?? ''}
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber
                        field.onChange(Number.isNaN(value) ? undefined : value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {option && <AddCreditsSummary option={option} units={units ?? 0} />}
          </Box>
          <Box
            flexDirection="column"
            rowGap="m"
            paddingHorizontal="2xl"
            paddingVertical="xl"
          >
            <Text variant="caption" color="muted">
              Credits don&apos;t expire and can&apos;t be removed once added.
            </Text>
            <Box columnGap="s">
              <Button
                type="submit"
                disabled={!option || !units}
                loading={creditCustomerMeter.isPending}
              >
                {units
                  ? `Add ${units.toLocaleString('en-US')} credits`
                  : 'Add credits'}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </Box>
          </Box>
        </Box>
      </Form>
    </Box>
  )
}
