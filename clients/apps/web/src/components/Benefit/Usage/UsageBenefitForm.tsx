'use client'

import { useMeters } from '@/hooks/queries/meters'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@polar-sh/ui/components/atoms/Select'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useContext } from 'react'
import { useFormContext } from 'react-hook-form'

interface UsageBenefitCreate {
  properties: {
    meterId: string
    credits: number
    aggregation: 'sum' | 'count'
    overage:
      | {
          enabled: boolean
          price: {
            currency: 'USD'
            amount: number
          }
        }
      | undefined
  }
}

export const UsageBenefitForm = ({ update: _ }: { update: boolean }) => {
  const { control, watch } = useFormContext<UsageBenefitCreate>()

  const { organization } = useContext(MaintainerOrganizationContext)
  const { data: meters } = useMeters(organization.id)

  const meterId = watch('properties.meterId', undefined)
  const meter = meters?.items.find((meter) => meter.id === meterId)

  const aggregationType = watch('properties.aggregation', 'sum')

  return (
    <>
      <FormField
        control={control}
        name="properties.meterId"
        rules={{
          required: true,
        }}
        render={({ field }) => {
          return (
            <FormItem className="flex flex-col gap-y-2">
              <div className="flex flex-col gap-y-2">
                <FormLabel>Meter</FormLabel>
                <FormDescription>
                  Meter which will be used to track usage
                </FormDescription>
              </div>
              <FormControl>
                <Select {...field} onValueChange={field.onChange}>
                  <SelectTrigger>
                    {meter?.name ?? <span>Select Meter</span>}
                  </SelectTrigger>
                  <SelectContent>
                    {meters?.items.map((meter) => (
                      <SelectItem key={meter.id} value={meter.id}>
                        {meter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      <FormField
        control={control}
        name="properties.credits"
        rules={{
          min: 0,
          required: true,
        }}
        render={({ field }) => {
          return (
            <FormItem className="flex flex-col gap-y-2">
              <div className="flex flex-col gap-y-2">
                <FormLabel>Credits</FormLabel>
                <FormDescription>
                  A preset amount of units that will be deducted from the total
                  usage every period
                </FormDescription>
              </div>
              <FormControl>
                <Input {...field} placeholder="500" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      <FormField
        control={control}
        name="properties.aggregation"
        rules={{
          required: true,
        }}
        render={({ field }) => {
          const triggerClassName =
            'dark:data-[state=active]:bg-polar-900 data-[state=active]:bg-white w-full'

          return (
            <FormItem className="flex flex-col gap-y-2">
              <div className="flex flex-col gap-y-2">
                <FormLabel>Aggregation Type</FormLabel>
                <FormDescription>
                  Aggregation type to use when calculating usage
                </FormDescription>
              </div>
              <FormControl>
                <Tabs
                  {...field}
                  onValueChange={field.onChange}
                  value={aggregationType}
                >
                  <TabsList className="dark:bg-polar-800 w-full rounded-full bg-gray-100">
                    <TabsTrigger className={triggerClassName} value="sum">
                      Sum
                    </TabsTrigger>
                    <TabsTrigger className={triggerClassName} value="count">
                      Count
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </FormControl>
            </FormItem>
          )
        }}
      />
    </>
  )
}
