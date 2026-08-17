'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import React, { useCallback } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import { MeteredTierCard } from './MeteredTierCard'

const formatUnits = (value: number) => value.toLocaleString('en-US')

const getMeteredTierTitle = (
  upTo: number | null | undefined,
  previousUpTo: number,
) => {
  const from = previousUpTo + 1
  if (upTo == null) return `Units ${formatUnits(from)}+`
  if (upTo === from) return `Unit ${formatUnits(from)}`
  return `Units ${formatUnits(from)}–${formatUnits(upTo)}`
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
      `prices.${index}.tiers.tiers.${currentTiers.length - 1}.up_to`,
      null,
    )
  }, [getValues, setValue, index])

  const addTier = useCallback(() => {
    const currentTiers = getValues(`prices.${index}.tiers.tiers`)
    const lastTier = currentTiers?.[currentTiers.length - 1]
    const previousUpTo = Number(
      currentTiers?.[(currentTiers?.length ?? 0) - 2]?.up_to ?? 0,
    )
    const newUpTo = previousUpTo > 0 ? previousUpTo * 2 : 1000

    if (currentTiers && currentTiers.length > 0) {
      setValue(
        `prices.${index}.tiers.tiers.${currentTiers.length - 1}.up_to`,
        newUpTo,
      )
    }
    append({ up_to: null, price_per_unit: lastTier?.price_per_unit ?? 0 })
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
        const previousUpTo = Number(tiers?.[tierIndex - 1]?.up_to ?? 0)
        return (
          <MeteredTierCard
            key={field.id}
            index={index}
            tierIndex={tierIndex}
            currency={currency}
            hasSingleTier={hasSingleTier}
            title={getMeteredTierTitle(tiers?.[tierIndex]?.up_to, previousUpTo)}
            previousUpTo={previousUpTo}
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
