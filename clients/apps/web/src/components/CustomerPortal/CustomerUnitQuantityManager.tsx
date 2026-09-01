'use client'

import { useCustomerUpdateSubscription } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { getUnitLabels } from '@/utils/product'
import { Client, isValidationError, schemas } from '@polar-sh/client'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

interface CustomerUnitQuantityManagerProps {
  api: Client
  subscription: schemas['CustomerSubscription']
  unitPrice: schemas['ProductPriceUnitBased']
  prorationBehavior?: schemas['CustomerOrganization']['proration_behavior']
  onUpdate?: () => void
}

const getUnitBounds = (
  unitPrice: schemas['ProductPriceUnitBased'],
): { min: number; max: number | null } => {
  const min = Math.max(1, unitPrice.minimum_units ?? 0)
  if (unitPrice.maximum_units != null) {
    return { min, max: unitPrice.maximum_units }
  }
  const lastBound = unitPrice.tiers.tiers.at(-1)?.bound ?? null
  return { min, max: lastBound }
}

export const CustomerUnitQuantityManager = ({
  api,
  subscription,
  unitPrice,
  prorationBehavior,
  onUpdate,
}: CustomerUnitQuantityManagerProps) => {
  const updateSubscription = useCustomerUpdateSubscription(api)

  const currentUnits = subscription.units ?? 1
  const { min, max } = useMemo(() => getUnitBounds(unitPrice), [unitPrice])
  const { unitLabel, unitLabelPlural } = getUnitLabels(unitPrice)

  const { handleSubmit, watch, setValue, setError } = useForm<{
    units: number
  }>({
    values: {
      units: currentUnits,
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const units = watch('units')
  const canDecrease = units > min
  const canIncrease = max == null || units < max
  const hasChanges = units !== currentUnits
  const unitNoun = units === 1 ? unitLabel : unitLabelPlural

  const [draft, setDraft] = useState(String(currentUnits))

  const setUnits = (value: number) => {
    setValue('units', value, { shouldValidate: true })
    setDraft(String(value))
  }

  const invoicingMessage = useMemo((): string | null => {
    if (!prorationBehavior) return null
    switch (prorationBehavior) {
      case 'invoice':
        return "You'll be charged immediately, with a proration for the current period."
      case 'prorate':
        return 'Your next invoice will include the updated units plus the proration for the current period.'
      case 'next_period':
        return 'The unit update will be applied on your next billing cycle.'
      case 'reset':
        return "You'll be charged the full new amount immediately, and your billing period restarts today."
    }
  }, [prorationBehavior])

  const onSubmit = useCallback(
    async (data: { units: number }) => {
      try {
        const result = await updateSubscription.mutateAsync({
          id: subscription.id,
          body: {
            units: data.units,
          },
        })

        if (result.error) {
          const errorMessage =
            typeof result.error.detail === 'string'
              ? result.error.detail
              : 'Failed to update units'
          toast({
            title: 'Error updating units',
            description: errorMessage,
            variant: 'error',
          })
        } else {
          const noun = data.units === 1 ? unitLabel : unitLabelPlural
          const description = `Subscription now has ${data.units} ${noun}.`
          toast({
            title: 'Units updated',
            description,
          })
          onUpdate?.()
        }
      } catch (error) {
        if (isValidationError(error)) {
          setValidationErrors(error, setError)
        } else {
          toast({
            title: 'Error updating units',
            description:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred',
            variant: 'error',
          })
        }
      }
    },
    [
      updateSubscription,
      subscription.id,
      unitLabel,
      unitLabelPlural,
      onUpdate,
      setError,
    ],
  )

  const handleIncrement = () => {
    if (canIncrease) {
      setUnits(units + 1)
    }
  }

  const handleDecrement = () => {
    if (canDecrease) {
      setUnits(units - 1)
    }
  }

  const clampUnits = (value: number): number => {
    const floored = Math.max(min, Math.floor(value))
    return max != null ? Math.min(max, floored) : floored
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    if (!/^\d*$/.test(raw)) {
      return
    }
    setDraft(raw)
    if (raw !== '') {
      setValue('units', Number.parseInt(raw, 10), { shouldValidate: true })
    }
  }

  const handleInputBlur = () => {
    const parsed = draft === '' ? min : Number.parseInt(draft, 10)
    setUnits(clampUnits(parsed))
  }

  return (
    <Box
      as="form"
      onSubmit={handleSubmit(onSubmit)}
      flexDirection="column"
      rowGap="l"
      padding="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
    >
      <Box alignItems="center" justifyContent="between">
        <Text variant="label">
          {unitNoun.charAt(0).toUpperCase() + unitNoun.slice(1)}
        </Text>
        <Box alignItems="center" columnGap="xs">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleDecrement}
            disabled={!canDecrease || updateSubscription.isPending}
          >
            <MinusIcon className="h-4 w-4" />
          </Button>

          <Input
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={updateSubscription.isPending}
            className="w-20 text-center font-medium"
          />

          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleIncrement}
            disabled={!canIncrease || updateSubscription.isPending}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Box flexDirection="column" rowGap="m">
          {invoicingMessage && (
            <Text variant="caption" color="muted">
              {invoicingMessage}
            </Text>
          )}
          <Button
            loading={updateSubscription.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Update units
          </Button>
        </Box>
      )}
    </Box>
  )
}
