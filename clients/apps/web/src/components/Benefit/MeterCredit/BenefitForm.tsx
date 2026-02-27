'use client'

import { schemas } from '@polar-sh/client'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { PlusIcon } from 'lucide-react'
import { useCallback } from 'react'
import { useFormContext } from 'react-hook-form'

import CreateMeterModalContent from '@/components/Meter/CreateMeterModalContent'
import MeterSelector from '@/components/Meter/MeterSelector'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { useMeters } from '@/hooks/queries/meters'
import Button from '@polar-sh/ui/components/atoms/Button'

export const MeterCreditBenefitForm = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { data: meters } = useMeters(organization.id, {
    sorting: ['name'],
    is_archived: false,
  })

  const { control, setValue } =
    useFormContext<schemas['BenefitMeterCreditCreate']>()

  const {
    isShown: isCreateMeterModalShown,
    show: showCreateMeterModal,
    hide: hideCreateMeterModal,
  } = useModal(false)

  const onSelectMeter = useCallback(
    (meter: schemas['Meter']) => {
      setValue('properties.meter_id', meter.id)
    },
    [setValue],
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
            name="properties.meter_id"
            rules={{
              required: 'This field is required',
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <div className="flex flex-row items-center justify-between gap-x-2">
                    <FormLabel>Meter</FormLabel>
                    <button
                      type="button"
                      className="flex flex-row items-center gap-x-1 text-sm font-medium text-gray-500"
                      onClick={(e) => {
                        e.preventDefault()
                        showCreateMeterModal()
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Meter
                    </button>
                  </div>
                  <FormControl>
                    <MeterSelector
                      organizationId={organization.id}
                      value={field.value || null}
                      onChange={(meterId) => field.onChange(meterId ?? '')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={control}
            name="properties.units"
            rules={{
              min: 0,
              max: 2147483647,
              required: 'This field is required',
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Number of credited units</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    If the billing cycle is recurring, units will be credited at
                    the beginning of each period.
                  </FormDescription>
                </FormItem>
              )
            }}
          />
          <FormField
            control={control}
            name="properties.rollover"
            defaultValue={false}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rollover unused credits</FormLabel>
                <FormControl>
                  <div className="flex flex-row items-center gap-x-2">
                    <Checkbox
                      defaultChecked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    {/* eslint-disable-next-line no-restricted-syntax */}
                    <p className="text-sm">
                      Rollover unused credits to the next billing cycle
                    </p>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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
