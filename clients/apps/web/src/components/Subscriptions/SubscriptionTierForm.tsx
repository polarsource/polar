'use client'

import {
  SubscriptionTierCreate,
  SubscriptionTierType,
  SubscriptionTierUpdate,
} from '@polar-sh/sdk'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Input } from 'polarkit/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/select'
import { Textarea } from 'polarkit/components/ui/textarea'
import React, { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'

interface SubscriptionTierFormProps {
  update?: boolean
}

const SubscriptionTierForm: React.FC<SubscriptionTierFormProps> = ({
  update,
}) => {
  const { control } = useFormContext<
    SubscriptionTierCreate | SubscriptionTierUpdate
  >()

  const subscriptionTierTypes = useMemo(
    () =>
      ({
        [SubscriptionTierType.HOBBY]: 'Hobby',
        [SubscriptionTierType.PRO]: 'Pro',
        [SubscriptionTierType.BUSINESS]: 'Business',
      } as const),
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
              <FormLabel>Group</FormLabel>
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
      <FormField
        control={control}
        name="price_amount"
        rules={{ required: 'This field is required', min: 0 }}
        render={({ field }) => {
          const displayValue = field.value ? field.value / 100 : undefined
          const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
            e.preventDefault()
            if (e.currentTarget.value) {
              e.currentTarget.value = (
                Number.parseInt(e.currentTarget.value) * 100
              ).toString()
              field.onChange(e)
            }
          }
          return (
            <FormItem className="max-w-[300px]">
              <FormLabel>Monthly Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={onChange}
                  value={displayValue}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />
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
              <Textarea className="resize-none" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

export default SubscriptionTierForm
