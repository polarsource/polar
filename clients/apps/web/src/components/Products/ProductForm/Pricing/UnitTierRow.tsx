'use client'

import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { Button, Grid, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'

const formatUnits = (value: number) => value.toLocaleString('en-US')

// The remove button stays out of the way until the row is hovered or focused,
// but only where hovering exists — on touch it must always be reachable.
const REMOVE_BUTTON_REVEAL =
  'h-7 w-7 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100'

export interface UnitTierRowProps {
  index: number
  tierIndex: number
  currency: string
  unitLabel: string
  title: string
  previousBound: number
  isLast: boolean
  canRemove: boolean
  onRemove: () => void
}

export const UnitTierRow: React.FC<UnitTierRowProps> = ({
  index,
  tierIndex,
  currency,
  unitLabel,
  title,
  previousBound,
  isLast,
  canRemove,
  onRemove,
}) => {
  const { control, setValue } = useFormContext<ProductFormType>()

  return (
    <Grid
      templateColumns="1fr 2fr 28px"
      columnGap="m"
      alignItems="center"
      role="group"
      aria-label={title}
      className="group"
    >
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
            <Box alignItems="center" columnGap="s">
              <Box minWidth={56} justifyContent="end" flexShrink={0}>
                <Text variant="body" color="muted" tabularNums>
                  {formatUnits(previousBound + 1)}
                </Text>
              </Box>
              <Text variant="body" color="disabled">
                –
              </Text>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={previousBound + 1}
                  step={1}
                  value={field.value ?? ''}
                  aria-label={`Upper limit, ${title}`}
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
            </Box>
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

      {canRemove && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={REMOVE_BUTTON_REVEAL}
          onClick={onRemove}
          aria-label={`Remove ${title}`}
        >
          <CloseOutlined className="h-3.5 w-3.5" />
        </Button>
      )}
    </Grid>
  )
}
