'use client'

import { formatScalar } from '@/utils/formatters'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Button, Grid, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import UnitAmountInput from '../UnitAmountInput'

export interface MeteredTierCardProps {
  index: number
  tierIndex: number
  currency: string
  hasSingleTier: boolean
  title: string
  previousBound: number
  isLast: boolean
  onRemove: () => void
}

export const MeteredTierCard: React.FC<MeteredTierCardProps> = ({
  index,
  tierIndex,
  currency,
  hasSingleTier,
  title,
  previousBound,
  isLast,
  onRemove,
}) => {
  const { control, setValue } = useFormContext<ProductFormType>()
  const titleId = `metered-tier-title-${index}-${tierIndex}`

  const handleBoundChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: number | null) => void,
  ) => {
    if (isLast) {
      return
    }
    const value = event.currentTarget.valueAsNumber
    onChange(Number.isNaN(value) ? null : value)
    setValue(`prices.${index}.id`, '')
  }

  const handleBoundBlur = (
    event: React.FocusEvent<HTMLInputElement>,
    onChange: (value: number | null) => void,
    onBlur: () => void,
  ) => {
    onBlur()
    if (isLast) {
      onChange(null)
      return
    }
    const parsed = event.currentTarget.valueAsNumber
    const minAllowed = previousBound + 1
    if (Number.isNaN(parsed)) {
      onChange(minAllowed)
      return
    }
    if (!Number.isInteger(parsed)) {
      return
    }
    onChange(Math.max(parsed, minAllowed))
  }

  const fields = (
    <Grid templateColumns="1fr 1fr" columnGap="m" alignItems="start">
      <FormField
        control={control}
        name={`prices.${index}.tiers.tiers.${tierIndex}.bound` as const}
        rules={{
          required: isLast ? false : 'Required',
          validate: (value) => {
            if (isLast && value == null) {
              return true
            }
            if (!Number.isInteger(value)) {
              return 'Must be a whole number of units'
            }
            if (value != null && value <= previousBound) {
              return `Must be greater than ${formatScalar(previousBound)}`
            }
            return true
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Up to</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                min={previousBound + 1}
                step={1}
                value={field.value ?? ''}
                readOnly={isLast}
                placeholder={isLast ? 'Unlimited' : undefined}
                onChange={(e) => handleBoundChange(e, field.onChange)}
                onBlur={(e) => handleBoundBlur(e, field.onChange, field.onBlur)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`prices.${index}.tiers.tiers.${tierIndex}.unit_amount` as const}
        rules={{
          required: 'This field is required',
          min: { value: 0, message: 'Must be 0 or more' },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Price per unit</FormLabel>
            <FormControl>
              <UnitAmountInput
                {...field}
                currency={currency}
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v)
                  setValue(`prices.${index}.id`, '')
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Grid>
  )

  if (hasSingleTier) {
    return fields
  }

  return (
    <Box
      flexDirection="column"
      rowGap="m"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-primary"
      padding="l"
      role="group"
      aria-labelledby={titleId}
    >
      <Box alignItems="start" justifyContent="between" columnGap="m">
        <Text id={titleId} as="span" variant="label" color="muted">
          {title}
        </Text>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="-my-1 h-7 w-7"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
        >
          <CloseOutlined className="h-3.5 w-3.5" />
        </Button>
      </Box>
      {fields}
    </Box>
  )
}
