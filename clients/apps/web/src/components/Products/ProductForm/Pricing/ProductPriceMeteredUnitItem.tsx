'use client'

import CreateMeterModalContent from '@/components/Meter/CreateMeterModalContent'
import MeterSelector from '@/components/Meter/MeterSelector'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import { SpinnerNoMargin } from '@polar-sh/orbit'
import { useMeters } from '@/hooks/queries/meters'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { PlusIcon } from 'lucide-react'
import React, { useCallback } from 'react'
import { useFormContext } from 'react-hook-form'
import { ProductFormType } from '../ProductForm'
import { MeteredPricingFields } from './MeteredPricingFields'

export interface ProductPriceMeteredUnitItemProps {
  organization: schemas['Organization']
  index: number
  currency: string
}

export const ProductPriceMeteredUnitItem: React.FC<
  ProductPriceMeteredUnitItemProps
> = ({ organization, index, currency }) => {
  const { control, setValue } = useFormContext<ProductFormType>()

  const { data: meters } = useMeters(organization.id, {
    sorting: ['name'],
    limit: 30,
    is_archived: false,
  })

  const {
    isShown: isCreateMeterModalShown,
    show: showCreateMeterModal,
    hide: hideCreateMeterModal,
  } = useModal(false)

  const onSelectMeter = useCallback(
    (meter: schemas['Meter']) => {
      setValue(`prices.${index}.meter_id`, meter.id)
      setValue(`prices.${index}.id`, '')
    },
    [setValue, index],
  )

  if (!meters) {
    return (
      <div className="flex w-full items-center justify-center py-4">
        <SpinnerNoMargin />
      </div>
    )
  }

  return (
    <>
      {meters.items.length === 0 ? (
        <Button
          onClick={(e) => {
            e.preventDefault()
            showCreateMeterModal()
          }}
          size="sm"
        >
          Create a Meter
        </Button>
      ) : (
        <>
          <FormField
            control={control}
            name={`prices.${index}.meter_id`}
            rules={{
              required: 'This field is required',
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <div className="flex flex-row items-center justify-between gap-x-2">
                    <FormLabel>Meter</FormLabel>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        showCreateMeterModal()
                      }}
                    >
                      <PlusIcon className="mr-1 h-4 w-4" />
                      Create Meter
                    </Button>
                  </div>
                  <FormControl>
                    <MeterSelector
                      organizationId={organization.id}
                      value={field.value || null}
                      onChange={(meterId) => {
                        field.onChange(meterId ?? '')
                        setValue(`prices.${index}.id`, '')
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <MeteredPricingFields
            organization={organization}
            index={index}
            currency={currency}
          />
        </>
      )}
      <InlineModal
        isShown={isCreateMeterModalShown}
        hide={hideCreateMeterModal}
        modalContent={
          <CreateMeterModalContent
            organization={organization}
            onSelectMeter={onSelectMeter}
            hideModal={hideCreateMeterModal}
          />
        }
      />
    </>
  )
}
