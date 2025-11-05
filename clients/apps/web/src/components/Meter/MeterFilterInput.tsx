'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
import { PlusIcon, TrashIcon, XIcon } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import MeterFilterInputProperty from './MeterFilterInputProperty'
import MeterFilterInputValue from './MeterFilterInputValue'

const OPERATOR_DISPLAY_NAMES: Record<schemas['FilterOperator'], string> = {
  eq: 'equals',
  ne: 'does not equal',
  gt: 'is greater than',
  gte: 'is greater than or equal to',
  lt: 'is less than',
  lte: 'is less than or equal to',
  like: 'contains',
  not_like: 'does not contain',
}

const isFilterClause = (
  filter: schemas['Filter'] | schemas['FilterClause'],
): filter is schemas['FilterClause'] => {
  return 'property' in filter
}

const MeterFilterInput = ({
  prefix,
  removeParent,
  organizationId,
}: {
  prefix: string
  removeParent?: () => void
  organizationId: string
}) => {
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
          <h3>Condition group</h3>
          <div className="flex flex-row items-center gap-x-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                append({ property: '', operator: 'eq', value: '' })
              }
            >
              <PlusIcon className="mr-1.5 size-3" strokeWidth={1.5} />
              <span>Add condition</span>
            </Button>
            {removeParent && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => removeParent()}
              >
                <XIcon className="mr-1.5 size-3" strokeWidth={1.5} />
                Remove condition group
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
              <div className="flex w-full flex-row items-start gap-x-2">
                <div
                  className={twMerge(
                    'text-muted-foreground flex h-10 w-8 flex-none items-center justify-center text-sm',
                    index === 0 ? 'opacity-20' : '',
                  )}
                >
                  {index === 0 ? '|' : conjunction}
                </div>
                <div className="grid grow grid-cols-[1fr_1fr_1fr_auto] items-start gap-x-2">
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
                            <MeterFilterInputProperty field={field} />
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
                      const allowedOperators =
                        property === 'name'
                          ? (['eq', 'ne', 'like', 'not_like'] as const)
                          : Object.keys(OPERATOR_DISPLAY_NAMES)

                      return (
                        <FormItem>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value || undefined}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select operator" />
                            </SelectTrigger>
                            <SelectContent>
                              {allowedOperators.map((operator) => (
                                <SelectItem key={operator} value={operator}>
                                  {
                                    OPERATOR_DISPLAY_NAMES[
                                      operator as schemas['FilterOperator']
                                    ]
                                  }
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
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
                      return (
                        <FormItem className="grow">
                          <FormControl>
                            <MeterFilterInputValue
                              field={field}
                              property={property}
                              organizationId={organizationId}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  <div className="flex h-10 items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className={twMerge(
                        'size-10',
                        index === 0 ? 'invisible' : '',
                      )}
                      onClick={() => remove(index)}
                    >
                      <TrashIcon className="size-3" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {index > 0 && (
                  <div className="text-muted-foreground w-12 pl-4 text-center text-sm">
                    {conjunction}
                  </div>
                )}
                <ShadowBox className="flex flex-col gap-4 rounded-2xl! p-4">
                  <MeterFilterInput
                    prefix={`${prefix}.clauses.${index}`}
                    removeParent={
                      clauses.length > 1 ? () => remove(index) : undefined
                    }
                    organizationId={organizationId}
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
            size="sm"
            variant="secondary"
            onClick={() =>
              append({
                conjunction: 'or',
                clauses: [{ property: '', operator: 'eq', value: '' }],
              })
            }
          >
            <PlusIcon className="mr-1.5 size-3" strokeWidth={1.5} />
            Add condition group
          </Button>
        </div>
      )}
    </div>
  )
}

export default MeterFilterInput
