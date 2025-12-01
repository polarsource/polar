import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@polar-sh/ui/components/atoms/Accordion'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import PercentageInput from '@polar-sh/ui/components/atoms/PercentageInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'

import { schemas } from '@polar-sh/client'
import DateTimePicker from '@polar-sh/ui/components/atoms/DateTimePicker'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React, { useCallback, useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import ProductSelect from '../Products/ProductSelect'

interface DiscountFormProps {
  organization: schemas['Organization']
  update: boolean
  redemptionsCount?: number
}

const DiscountForm: React.FC<DiscountFormProps> = ({
  organization,
  update,
  redemptionsCount,
}) => {
  const { control, watch, setValue } = useFormContext<
    (schemas['DiscountCreate'] | schemas['DiscountUpdate']) & {
      products: { id: string }[]
    }
  >()
  const type = watch('type') as schemas['DiscountType']
  const duration = watch('duration') as schemas['DiscountDuration']

  const now = useMemo(() => new Date(), [])
  const startsAt = watch('starts_at')
  const endsAt = watch('ends_at')

  const canUpdateAmount =
    redemptionsCount === undefined || redemptionsCount === 0

  const generateDiscountCode = useCallback(() => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const length = 8
    let code = ''
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    setValue('code', code)
  }, [setValue])

  return (
    <>
      <FormField
        control={control}
        name="name"
        rules={{
          minLength: {
            value: 1,
            message: 'This field must not be empty',
          },
          required: 'This field is required',
        }}
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
              <FormDescription>
                Displayed to the customer when they apply the discount.
              </FormDescription>
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name="code"
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input {...field} value={field.value || ''} />
                  <div className="absolute inset-y-0 right-1 z-10 flex items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={generateDiscountCode}
                    >
                      <AutorenewOutlined fontSize="small" />
                    </Button>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
              <FormDescription>
                Optional code (case insensitive) that the customer can use to
                apply the discount. If left empty, the discount can only be
                applied through a Checkout Link or the API.
              </FormDescription>
            </FormItem>
          )
        }}
      />
      {!update && (
        <Tabs
          value={type}
          onValueChange={(value: string) =>
            setValue('type', value as schemas['DiscountType'])
          }
        >
          <TabsList className="dark:bg-polar-950 w-full flex-row items-center rounded-full bg-gray-100">
            <TabsTrigger
              className="dark:data-[state=active]:bg-polar-800 grow rounded-full! data-[state=active]:bg-white"
              value="percentage"
            >
              Percentage discount
            </TabsTrigger>
            <TabsTrigger
              className="dark:data-[state=active]:bg-polar-800 grow rounded-full! data-[state=active]:bg-white"
              value="fixed"
            >
              Fixed amount discount
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {type === 'percentage' && (
        <FormField
          control={control}
          name="basis_points"
          shouldUnregister={type !== 'percentage'}
          rules={{
            required: 'This field is required',
            min: { value: 1, message: 'This field must be at least 0.01%' },
            max: {
              value: 10000,
              message: 'This field must be at most 100%',
            },
          }}
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Percentage</FormLabel>
                <FormControl>
                  <PercentageInput
                    {...field}
                    value={field.value || undefined}
                    placeholder={1000}
                    disabled={!canUpdateAmount}
                  />
                </FormControl>
                {!canUpdateAmount && (
                  <FormDescription>
                    The percentage cannot be changed once the discount has been
                    redeemed by a customer.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )
          }}
        />
      )}

      {type === 'fixed' && (
        <FormField
          control={control}
          name="amount"
          shouldUnregister={type !== 'fixed'}
          rules={{
            required: 'This field is required',
            min: { value: 1, message: 'This field must be at least 1' },
          }}
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <MoneyInput
                    {...field}
                    value={field.value || undefined}
                    placeholder={1000}
                    disabled={!canUpdateAmount}
                  />
                </FormControl>
                {!canUpdateAmount && (
                  <FormDescription>
                    The amount cannot be changed once the discount has been
                    redeemed by a customer.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )
          }}
        />
      )}

      <Accordion type="single" collapsible className="flex flex-col gap-y-6">
        <AccordionItem
          value="form-input-options"
          className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
        >
          <AccordionTrigger className="hover:no-underline">
            Recurring options
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-y-6">
            <FormField
              control={control}
              name="duration"
              rules={{
                required: 'This field is required',
              }}
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || undefined}
                        disabled={update}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once">Once</SelectItem>
                          <SelectItem value="forever">Forever</SelectItem>
                          <SelectItem value="repeating">
                            For several months
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      {duration === 'once' &&
                        'The discount is applied once on the first invoice.'}
                      {duration === 'forever' &&
                        'The discount is applied on every invoice.'}
                      {duration === 'repeating' &&
                        'The discount is applied for a set number of months.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            {duration === 'repeating' && (
              <FormField
                control={control}
                name="duration_in_months"
                shouldUnregister={duration !== 'repeating'}
                rules={{
                  required: 'This field is required',
                  min: {
                    value: 1,
                    message: 'This field must be at least 1',
                  },
                }}
                defaultValue={1}
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Number of months</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || undefined}
                          type="number"
                          min={1}
                        />
                      </FormControl>
                      <FormMessage />
                      <FormDescription>
                        The discount will be applied the first{' '}
                        {Number.parseInt(field.value as unknown as string) === 1
                          ? 'month'
                          : `${field.value} months`}
                        .
                      </FormDescription>
                    </FormItem>
                  )
                }}
              />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion type="single" collapsible className="flex flex-col gap-y-6">
        <AccordionItem
          value="form-input-options"
          className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
        >
          <AccordionTrigger className="hover:no-underline">
            Restrictions
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-y-6">
            <FormField
              control={control}
              name="products"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Products</FormLabel>
                    <FormControl>
                      <ProductSelect
                        organization={organization}
                        value={field.value || []}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Only the selected products will be eligible for the
                      discount.
                    </FormDescription>
                  </FormItem>
                )
              }}
            />
            <FormField
              control={control}
              name="starts_at"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Starts at</FormLabel>
                    <DateTimePicker
                      value={field.value || undefined}
                      onChange={(value) => {
                        field.onChange(value || null)
                      }}
                      disabled={[
                        { before: now },
                        ...(endsAt ? [{ after: new Date(endsAt) }] : []),
                      ]}
                    />
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={control}
              name="ends_at"
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Ends at</FormLabel>
                    <DateTimePicker
                      value={field.value || undefined}
                      onChange={(value) => {
                        field.onChange(value || null)
                      }}
                      disabled={{
                        before: startsAt ? new Date(startsAt) : now,
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            <FormField
              control={control}
              name="max_redemptions"
              rules={{
                min: { value: 1, message: 'This field must be at least 1' },
              }}
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>Maximum number of redemptions</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(
                            value === '' ? null : parseInt(value, 10),
                          )
                        }}
                        min={1}
                      />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      Limit applies across all customers, not per customer.
                    </FormDescription>
                  </FormItem>
                )
              }}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  )
}

export default DiscountForm
