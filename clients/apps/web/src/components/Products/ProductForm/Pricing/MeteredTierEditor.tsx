'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import React, { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import { MeteredTierCard } from './MeteredTierCard'

const formatUnits = (value: number) => value.toLocaleString('en-US')

const getMeteredTierTitle = (
  bound: number | null | undefined,
  previousBound: number,
) => {
  const from = previousBound + 1
  if (bound == null) return `Units ${formatUnits(from)}+`
  if (bound === from) return `Unit ${formatUnits(from)}`
  return `Units ${formatUnits(from)}–${formatUnits(bound)}`
}

export interface MeteredTierEditorProps {
  index: number
  currency: string
}

export const MeteredTierEditor: React.FC<MeteredTierEditorProps> = ({
  index,
  currency,
}) => {
  const { control, setValue, watch, getValues } =
    useFormContext<ProductFormType>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `prices.${index}.tiers.tiers` as const,
  })

  const tiers = watch(`prices.${index}.tiers.tiers`)
  const hasSingleTier = fields.length === 1

  const forceLastTierUnbounded = useCallback(() => {
    const currentTiers = getValues(`prices.${index}.tiers.tiers`)
    if (!currentTiers || currentTiers.length === 0) return
    setValue(
      `prices.${index}.tiers.tiers.${currentTiers.length - 1}.bound`,
      null,
    )
  }, [getValues, setValue, index])

  const addTier = useCallback(() => {
    const currentTiers = getValues(`prices.${index}.tiers.tiers`)
    const lastTier = currentTiers?.[currentTiers.length - 1]
    const previousBound = Number(
      currentTiers?.[(currentTiers?.length ?? 0) - 2]?.bound ?? 0,
    )
    const newBound = previousBound > 0 ? previousBound * 2 : 1000

    if (currentTiers && currentTiers.length > 0) {
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
      remove(tierIndex)
      setValue(`prices.${index}.id`, '')
      forceLastTierUnbounded()
    },
    [remove, setValue, index, forceLastTierUnbounded],
  )

  return (
    <Box flexDirection="column" rowGap="l">
      {fields.map((field, tierIndex) => {
        const previousBound = Number(tiers?.[tierIndex - 1]?.bound ?? 0)
        return (
          <MeteredTierCard
            key={field.id}
            index={index}
            tierIndex={tierIndex}
            currency={currency}
            hasSingleTier={hasSingleTier}
            title={getMeteredTierTitle(tiers?.[tierIndex]?.bound, previousBound)}
            previousBound={previousBound}
            isLast={tierIndex === fields.length - 1}
            onRemove={() => removeTier(tierIndex)}
          />
        )
      })}

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
