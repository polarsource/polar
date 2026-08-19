'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Box } from '@polar-sh/orbit/Box'
import { Button, Grid, Input, Text } from '@polar-sh/orbit'
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

export interface UnitTierCardProps {
  index: number
  tierIndex: number
  currency: string
  hasSingleTier: boolean
  title: string
  previousBound: number
  isLast: boolean
  onRemove: () => void
}

export const UnitTierCard: React.FC<UnitTierCardProps> = ({
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
  const titleId = `unit-tier-title-${index}-${tierIndex}`

  return (
    <Box
      flexDirection="column"
      rowGap="l"
      role="group"
      aria-labelledby={hasSingleTier ? undefined : titleId}
      {...(hasSingleTier
        ? {}
        : {
            borderRadius: 'l' as const,
            borderWidth: 1,
            borderStyle: 'solid' as const,
            borderColor: 'border-primary' as const,
            backgroundColor: 'background-primary' as const,
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
            className="-my-1 h-7 w-7"
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
                return `Must be greater than ${previousBound.toLocaleString('en-US')}`
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
              <FormLabel>Price per unit</FormLabel>
              <FormControl>
                <Box ref={field.ref} tabIndex={-1} display="block">
                  <MoneyInput
                    name={field.name}
                    currency={currency}
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
    </Box>
  )
}
