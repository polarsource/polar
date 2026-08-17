'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Box } from '@polar-sh/orbit/Box'
import { Button, Grid, Input, Text } from '@polar-sh/orbit'
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
  previousUpTo: number
  isLast: boolean
  onRemove: () => void
}

export const MeteredTierCard: React.FC<MeteredTierCardProps> = ({
  index,
  tierIndex,
  currency,
  hasSingleTier,
  title,
  previousUpTo,
  isLast,
  onRemove,
}) => {
  const { control, setValue } = useFormContext<ProductFormType>()
  const titleId = `metered-tier-title-${index}-${tierIndex}`

  return (
    <Box
      flexDirection="column"
      rowGap="m"
      role="group"
      aria-labelledby={hasSingleTier ? undefined : titleId}
      {...(hasSingleTier
        ? {}
        : {
            borderRadius: 'l' as const,
            borderWidth: 1,
            borderStyle: 'solid' as const,
            borderColor: 'border-primary' as const,
            backgroundColor: 'background-card' as const,
            padding: 'l' as const,
          })}
    >
      {!hasSingleTier && (
        <Box alignItems="center" justifyContent="between">
          <Text id={titleId} as="span" variant="label" color="muted">
            {title}
          </Text>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
          >
            <CloseOutlined className="h-3.5 w-3.5" />
          </Button>
        </Box>
      )}

      <Grid templateColumns="1fr 2fr" columnGap="l">
        <FormField
          control={control}
          name={`prices.${index}.tiers.tiers.${tierIndex}.bound` as const}
          rules={
            isLast
              ? undefined
              : {
                  required: 'Required',
                  validate: (value) => {
                    const parsed = Number(value)
                    if (!Number.isInteger(parsed)) {
                      return 'Must be a whole number of units'
                    }
                    if (parsed <= previousUpTo) {
                      return `Must be greater than ${previousUpTo.toLocaleString('en-US')}`
                    }
                    return true
                  },
                }
          }
          render={({ field }) => (
            <FormItem>
              <FormLabel>Up to</FormLabel>
              <FormControl>
                {isLast ? (
                  <Input
                    name={field.name}
                    value="Unlimited"
                    disabled
                    readOnly
                    ref={field.ref}
                  />
                ) : (
                  <Input
                    {...field}
                    type="number"
                    min={previousUpTo + 1}
                    step={1}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10)
                      field.onChange(Number.isNaN(parsed) ? '' : parsed)
                      setValue(`prices.${index}.id`, '')
                    }}
                    onBlur={(e) => {
                      field.onBlur()
                      const parsed = Number.parseInt(e.target.value, 10)
                      const minAllowed = previousUpTo + 1
                      field.onChange(
                        Math.max(
                          Number.isNaN(parsed) ? minAllowed : parsed,
                          minAllowed,
                        ),
                      )
                    }}
                  />
                )}
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
                  name={field.name}
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
    </Box>
  )
}
