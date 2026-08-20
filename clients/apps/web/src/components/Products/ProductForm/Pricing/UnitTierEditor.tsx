'use client'

import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import React, { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import { UnitTierRow } from './UnitTierRow'

const formatUnits = (value: number) => value.toLocaleString('en-US')

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)

const getUnitTierTitle = (
  bound: number | null | undefined,
  previousBound: number,
) => {
  const from = previousBound + 1
  if (bound == null) return `Units ${formatUnits(from)}+`
  if (bound === from) return `Unit ${formatUnits(from)}`
  return `Units ${formatUnits(from)}–${formatUnits(bound)}`
}

export interface UnitTierEditorProps {
  index: number
  currency: string
  unitLabel: string
  unitLabelPlural: string
}

export const UnitTierEditor: React.FC<UnitTierEditorProps> = ({
  index,
  currency,
  unitLabel,
  unitLabelPlural,
}) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `prices.${index}.tiers.tiers` as const,
  })

  const tiers = watch(`prices.${index}.tiers.tiers`)

  const addTier = useCallback(() => {
    const currentTiers = getValues(`prices.${index}.tiers.tiers`)
    const lastTier = currentTiers?.[currentTiers.length - 1]
    const previousBound = Number(
      currentTiers?.[(currentTiers?.length ?? 0) - 2]?.bound ?? 0,
    )
    const newBound = previousBound > 0 ? previousBound * 2 : 1000

    if (currentTiers && currentTiers.length > 0 && lastTier?.bound == null) {
      setValue(
        `prices.${index}.tiers.tiers.${currentTiers.length - 1}.bound`,
        newBound,
      )
    }
    append({ bound: null, unit_amount: lastTier?.unit_amount ?? 0 })
    setValue(`prices.${index}.id`, '')
  }, [getValues, append, setValue, index])

  const removeTier = useCallback(
    (tierIndex: number) => {
      const wasLast =
        tierIndex ===
        (getValues(`prices.${index}.tiers.tiers`)?.length ?? 0) - 1
      remove(tierIndex)
      const remainingTiers = getValues(`prices.${index}.tiers.tiers`) ?? []
      if (wasLast && remainingTiers.length > 0) {
        setValue(
          `prices.${index}.tiers.tiers.${remainingTiers.length - 1}.bound`,
          null,
        )
      }
      setValue(`prices.${index}.id`, '')
    },
    [remove, getValues, setValue, index],
  )

  return (
    <Box flexDirection="column" rowGap="m">
      <Grid templateColumns="1fr 2fr 28px" columnGap="m">
        <Text variant="label" color="muted">
          {capitalize(unitLabelPlural)}
        </Text>
        <Text variant="label" color="muted">
          Price per {unitLabel}
        </Text>
      </Grid>

      <Box flexDirection="column" rowGap="s">
        {fields.map((field, tierIndex) => {
          const previousBound = Number(tiers?.[tierIndex - 1]?.bound ?? 0)
          return (
            <UnitTierRow
              key={field.id}
              index={index}
              tierIndex={tierIndex}
              currency={currency}
              unitLabel={unitLabel}
              title={getUnitTierTitle(tiers?.[tierIndex]?.bound, previousBound)}
              previousBound={previousBound}
              isLast={tierIndex === fields.length - 1}
              canRemove={fields.length > 1}
              onRemove={() => removeTier(tierIndex)}
            />
          )
        })}
      </Box>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addTier}
        className="self-start"
      >
        Add tier
      </Button>
    </Box>
  )
}
