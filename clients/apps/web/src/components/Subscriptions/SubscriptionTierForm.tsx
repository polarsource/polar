'use client'

import {
  SubscriptionTierCreate,
  SubscriptionTierType,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import Input from 'polarkit/components/ui/atoms/input'
import MoneyInput from 'polarkit/components/ui/atoms/moneyinput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import React, { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'

interface SubscriptionTierFormProps {
  update?: boolean
  isFreeTier?: boolean
}

const SubscriptionTierForm: React.FC<SubscriptionTierFormProps> = ({
  update,
  isFreeTier,
}) => {
  const { control } = useFormContext<
    SubscriptionTierCreate | SubscriptionTierUpdate
  >()

  const subscriptionTierTypes = useMemo(
    () =>
      ({
        [SubscriptionTierType.INDIVIDUAL]: 'Individual',
        [SubscriptionTierType.BUSINESS]: 'Business',
      }) as const,
    [],
  )

  return (
    <>
      <FormField
        control={control}
        name="name"
        rules={{
          required: 'This field is required',
          minLength: 3,
          maxLength: 24,
        }}
        defaultValue=""
        render={({ field }) => (
          <FormItem className="max-w-[300px]">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Name</FormLabel>
              <span className="dark:text-polar-400 text-sm text-gray-400">
                {field.value?.length ?? 0} / 24
              </span>
            </div>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {!update && (
        <FormField
          control={control}
          name="type"
          rules={{ required: 'This field is required' }}
          render={({ field }) => (
            <FormItem className="max-w-[300px]">
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tier type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(subscriptionTierTypes).map(
                    ([type, pretty]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <SubscriptionGroupIcon
                            type={type as SubscriptionTierType}
                          />
                          {pretty}
                        </div>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {!isFreeTier && (
        <>
          <FormField
            control={control}
            name="is_highlighted"
            render={({ field }) => {
              return (
                <div className="flex flex-col gap-y-4">
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        defaultChecked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm leading-none">
                      Highlight this tier
                    </FormLabel>
                  </FormItem>
                  <p className="dark:text-polar-500 text-sm text-gray-500">
                    Highlighted tiers are shown on the public overview page.
                    <br />
                    Only one tier can be highlighted per tier type.
                  </p>
                </div>
              )
            }}
          />
          <FormField
            control={control}
            name="price_amount"
            rules={{ required: 'This field is required', min: 0 }}
            render={({ field }) => {
              return (
                <FormItem className="max-w-[300px]">
                  <FormLabel>Monthly Price</FormLabel>
                  <FormControl>
                    <MoneyInput
                      id="monthly-price"
                      name={field.name}
                      value={field.value}
                      onAmountChangeInCents={field.onChange}
                      placeholder={0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </>
      )}
      <FormField
        control={control}
        name="description"
        rules={{
          maxLength: 240,
        }}
        render={({ field }) => (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Description</FormLabel>
              <span className="dark:text-polar-400 text-sm text-gray-400">
                {field.value?.length ?? 0} / 240
              </span>
            </div>
            <FormControl>
              <TextArea {...field} resizable={false} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

export default SubscriptionTierForm
