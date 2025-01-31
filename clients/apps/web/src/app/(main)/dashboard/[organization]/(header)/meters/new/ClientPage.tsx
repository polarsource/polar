'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useToast } from '@/components/Toast/use-toast'
import { useCreateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CountAggregationFuncEnum,
  Filter,
  FilterClause,
  FilterOperator,
  MeterCreate,
  Organization,
  PropertyAggregationFuncEnum,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useFieldArray, useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

const OPERATOR_DISPLAY_NAMES: Record<FilterOperator, string> = {
  eq: 'Equals',
  ne: 'Not Equals',
  gt: 'Greater Than',
  gte: 'Greater Than or Equals',
  lt: 'Less Than',
  lte: 'Less Than or Equals',
  like: 'Contains',
  not_like: 'Does Not Contain',
}

const AGGREGATION_FUNCTION_DISPLAY_NAMES: Record<
  CountAggregationFuncEnum | PropertyAggregationFuncEnum,
  string
> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
}

const isFilterClause = (
  filter: Filter | FilterClause,
): filter is FilterClause => {
  return 'property' in filter
}

const FilterInput: React.FC<{ prefix: string; removeParent?: () => void }> = ({
  prefix,
  removeParent,
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
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="p-2"
            onClick={() => append({ property: '', operator: 'eq', value: '' })}
          >
            <Plus className="h-2 w-2" />
          </Button>
          {removeParent && (
            <Button
              type="button"
              variant="secondary"
              className="p-2"
              onClick={() => removeParent()}
            >
              <X className="h-2 w-2" />
            </Button>
          )}
        </div>
      )}
      {clauses.map((clause, index) => {
        return (
          <div key={index}>
            {isFilterClause(clause as unknown as Filter | FilterClause) ? (
              <div className="flex w-full flex-row items-center gap-x-4">
                <div
                  className={twMerge(
                    'text-muted-foreground',
                    index === 0 ? 'invisible' : 'visible',
                  )}
                >
                  {conjunction}
                </div>
                <div className="grid grow grid-cols-3 gap-x-4">
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
                      return (
                        <FormItem className="grow">
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
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className={twMerge('p-2', index === 0 ? 'invisible' : '')}
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
                <ShadowBox className="flex flex-col gap-4 p-4">
                  <FilterInput
                    prefix={`${prefix}.clauses.${index}`}
                    removeParent={
                      clauses.length > 1 ? () => remove(index) : undefined
                    }
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
            Add condition group
          </Button>
        </div>
      )}
    </div>
  )
}

const ClientPage = ({ organization }: { organization: Organization }) => {
  const router = useRouter()
  const form = useForm<MeterCreate>({
    defaultValues: {
      filter: {
        conjunction: 'and',
        clauses: [
          {
            conjunction: 'or',
            clauses: [
              {
                property: 'name',
                operator: 'eq',
                value: '',
              },
            ],
          },
        ],
      },
      aggregation: {
        func: 'count',
      },
    },
  })
  const { handleSubmit, setError, control, watch } = form
  const createMeter = useCreateMeter(organization.id)
  const { toast } = useToast()

  const onSubmit = useCallback(
    async (body: MeterCreate) => {
      try {
        const meter = await createMeter.mutateAsync(body)
        toast({
          title: 'Meter Created',
          description: `Meter successfully created.`,
        })
        router.push(`/dashboard/${organization.slug}/meters/${meter.id}`)
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          }
        }
      }
    },
    [createMeter, router, organization, toast, setError],
  )

  const aggregationFunction = watch('aggregation.func')

  return (
    <DashboardBody title="Create Meter">
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <FormField
            control={control}
            name="name"
            rules={{
              minLength: {
                value: 3,
                message: 'This field must be at least 3 characters long',
              },
              required: 'This field is required',
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Will be shown on customer&apos;s invoices and usage.
                  </FormDescription>
                </FormItem>
              )
            }}
          />
          <FormItem>
            <FormLabel>Filters</FormLabel>
            <FilterInput prefix="filter" />
          </FormItem>
          <FormItem>
            <FormLabel>Aggregation</FormLabel>
            <div className="grid grid-cols-2 gap-x-4">
              <FormField
                control={control}
                name="aggregation.func"
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
                          <SelectValue placeholder="Select aggregation function" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(
                            AGGREGATION_FUNCTION_DISPLAY_NAMES,
                          ).map(([func, displayName]) => (
                            <SelectItem key={func} value={func}>
                              {displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )
                }}
              />
              {aggregationFunction !== 'count' && (
                <FormField
                  control={control}
                  name="aggregation.property"
                  rules={{
                    required: 'This field is required',
                  }}
                  render={({ field }) => {
                    return (
                      <FormItem className="grow">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Over property"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              )}
            </div>
          </FormItem>
          <Button
            type="submit"
            size="lg"
            loading={createMeter.isPending}
            disabled={createMeter.isPending}
          >
            Create Meter
          </Button>
        </form>
      </Form>
    </DashboardBody>
  )
}

export default ClientPage
