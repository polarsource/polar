'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCreditCustomerMeter } from '@/hooks/queries/customerMeters'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
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
import { getMeterUnitLabel, parseCreditUnits } from './creditPreview'
import { useMeterCreditOptions } from './useMeterCreditOptions'

interface AddCreditsForm {
  meter_id: string
  units: string
}

const BODY_SCHEMAS = [
  'CustomerMeterCreditsCustomerIDCreate',
  'CustomerMeterCreditsCustomerExternalIDCreate',
]

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
    defaultValues: { meter_id: meterId ?? '', units: '' },
  })

  const values = useWatch({ control: form.control })
  const option = options.find((o) => o.meter.id === values.meter_id)
  const units = parseCreditUnits(values.units ?? '')
  const customerName = customer.name || customer.email || 'this customer'

  const onSubmit = async (values: AddCreditsForm) => {
    const parsedUnits = parseCreditUnits(values.units)
    if (!option || !parsedUnits) return

    const { error } = await creditCustomerMeter.mutateAsync({
      customer_id: customer.id,
      meter_id: option.meter.id,
      units: parsedUnits,
      rollover: true,
      external_id: externalId,
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, form.setError, 1, BODY_SCHEMAS)
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
      description: `Added ${parsedUnits.toLocaleString('en-US')} credits on ${option.meter.name} for ${customerName}.`,
    })
    onClose()
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
            <Text color="muted">
              Give {customerName} free usage on a meter. Credits are used before
              anything is billed.
            </Text>
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
                validate: (value) =>
                  parseCreditUnits(value) !== null ||
                  'Enter a whole number between 1 and 1,000,000,000',
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credits</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      placeholder="1,000"
                      postSlot={
                        <span>
                          {option ? getMeterUnitLabel(option.meter) : 'units'}
                        </span>
                      }
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
