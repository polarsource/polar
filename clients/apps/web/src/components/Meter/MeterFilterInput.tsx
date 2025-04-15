'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Plus, X } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

const OPERATOR_DISPLAY_NAMES: Record<schemas['FilterOperator'], string> = {
  eq: 'Equals',
  ne: 'Not Equals',
  gt: 'Greater Than',
  gte: 'Greater Than or Equals',
  lt: 'Less Than',
  lte: 'Less Than or Equals',
  like: 'Contains',
  not_like: 'Does Not Contain',
}

const isFilterClause = (
  filter: schemas['Filter'] | schemas['FilterClause'],
): filter is schemas['FilterClause'] => {
  return 'property' in filter
}

const MeterFilterInput: React.FC<{
  prefix: string
  removeParent?: () => void
  eventNames?: schemas['EventName'][]
}> = ({ prefix, removeParent, eventNames }) => {
  const { control, watch } = useFormContext()
  const conjunction = watch(`${prefix}.conjunction`) as string
  const {
    fields: clauses,
    append,
    remove,
  } = useFieldArray({
    control,
    name: `${prefix}.clauses`,
  })

  return (
    <div className="flex flex-col gap-4">
      {/* To make the UI more digest, we don't allow to add single clause at the root level */}
      {prefix !== 'filter' && (
        <div className="flex items-center justify-between gap-2">
          <h3>Filter</h3>
          <div className="flex flex-row items-center gap-x-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8"
              onClick={() =>
                append({ property: '', operator: 'eq', value: '' })
              }
            >
              <Plus className="h-2 w-2" />
            </Button>
            {removeParent && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 w-8"
                onClick={() => removeParent()}
              >
                <X className="h-2 w-2" />
              </Button>
            )}
          </div>
        </div>
      )}
      {clauses.map((clause, index) => {
        const property = watch(`${prefix}.clauses.${index}.property`)

        return (
          <div key={index}>
            {isFilterClause(
              clause as unknown as schemas['Filter'] | schemas['FilterClause'],
            ) ? (
              <div className="flex w-full flex-row items-center gap-x-2">
                <div
                  className={twMerge(
                    'text-muted-foreground flex w-8 items-center justify-center',
                  )}
                >
                  {index === 0 ? '•' : conjunction}
                </div>
                <div className="grid grow grid-cols-3 gap-x-2">
                  <FormField
                    control={control}
                    name={`${prefix}.clauses.${index}.property`}
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              autoComplete="off"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  <FormField
                    control={control}
                    name={`${prefix}.clauses.${index}.operator`}
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem className="grow">
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value || undefined}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select operator" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(OPERATOR_DISPLAY_NAMES).map(
                                ([operator, displayName]) => (
                                  <SelectItem key={operator} value={operator}>
                                    {displayName}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )
                    }}
                  />
                  <FormField
                    control={control}
                    name={`${prefix}.clauses.${index}.value`}
                    rules={{
                      required: 'This field is required',
                    }}
                    render={({ field }) => {
                      const mostCommonEventName = eventNames?.[0]?.name

                      return (
                        <FormItem className="flex grow flex-row items-center gap-x-2 space-y-0">
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              autoComplete="off"
                              placeholder={
                                property === 'name'
                                  ? mostCommonEventName
                                  : undefined
                              }
                              onChange={(e) => {
                                const val = e.target.value
                                // Try parsing as float
                                const floatVal = parseFloat(val)
                                if (!isNaN(floatVal)) {
                                  field.onChange(floatVal)
                                  return
                                }
                                // Try parsing as boolean
                                if (val.toLowerCase() === 'true') {
                                  field.onChange(true)
                                  return
                                }
                                if (val.toLowerCase() === 'false') {
                                  field.onChange(false)
                                  return
                                }
                                // Fallback to string
                                field.onChange(val)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={twMerge('h-8 w-8', index === 0 ? 'invisible' : '')}
                  onClick={() => remove(index)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {index > 0 && (
                  <div className="text-muted-foreground ml-4">
                    {conjunction}
                  </div>
                )}
                <ShadowBox className="flex flex-col gap-4 !rounded-2xl p-4">
                  <MeterFilterInput
                    prefix={`${prefix}.clauses.${index}`}
                    removeParent={
                      clauses.length > 1 ? () => remove(index) : undefined
                    }
                    eventNames={eventNames}
                  />
                </ShadowBox>
              </div>
            )}
          </div>
        )
      })}
      {/* To make the UI more digest, we only allow to add new groups at the root level */}
      {prefix === 'filter' && (
        <div className="flex justify-start">
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              append({
                conjunction: 'or',
                clauses: [{ property: '', operator: 'eq', value: '' }],
              })
            }
          >
            Add Condition Group
          </Button>
        </div>
      )}
    </div>
  )
}

export default MeterFilterInput
