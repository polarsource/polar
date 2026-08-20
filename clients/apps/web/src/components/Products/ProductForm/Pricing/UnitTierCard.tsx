'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Button, Grid, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
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

const formatUnits = (value: number) => value.toLocaleString('en-US')

export interface UnitTierCardProps {
  index: number
  tierIndex: number
  currency: string
  unitLabel: string
  title: string
  previousBound: number
  isLast: boolean
  isOnlyTier: boolean
  onRemove: () => void
}

export const UnitTierCard: React.FC<UnitTierCardProps> = ({
  index,
  tierIndex,
  currency,
  unitLabel,
  title,
  previousBound,
  isLast,
  isOnlyTier,
  onRemove,
}) => {
  const { control, setValue } = useFormContext<ProductFormType>()
  const titleId = `unit-tier-title-${index}-${tierIndex}`

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
            const parsed = Number(value)
            if (!Number.isInteger(parsed)) {
              return 'Must be a whole number of units'
            }
            if (parsed <= previousBound) {
              return `Must be greater than ${formatUnits(previousBound)}`
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
                placeholder={isLast ? 'Unlimited' : undefined}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10)
                  field.onChange(Number.isNaN(parsed) ? null : parsed)
                  setValue(`prices.${index}.id`, '')
                }}
                onBlur={(e) => {
                  field.onBlur()
                  const parsed = Number.parseInt(e.target.value, 10)
                  const minAllowed = previousBound + 1
                  if (Number.isNaN(parsed)) {
                    field.onChange(isLast ? null : minAllowed)
                    return
                  }
                  field.onChange(Math.max(parsed, minAllowed))
                }}
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
            <FormLabel>Price per {unitLabel}</FormLabel>
            <FormControl>
              <Box ref={field.ref} tabIndex={-1} display="block">
                <MoneyInput
                  name={field.name}
                  currency={currency}
                  aria-label={`Price per ${unitLabel}, ${title}`}
                  value={
                    typeof field.value === 'number'
                      ? field.value
                      : field.value != null
                        ? Number(field.value)
                        : null
                  }
                  onChange={(v) => {
                    field.onChange(v)
                    setValue(`prices.${index}.id`, '')
                  }}
                  placeholder={1000}
                />
              </Box>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Grid>
  )

  if (isOnlyTier) {
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
