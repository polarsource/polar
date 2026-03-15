'use client'

import MeterSelector from '@/components/Meter/MeterSelector'
import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useCreateMetricDefinition,
  useDeleteMetricDefinition,
  useMetricDefinitions,
  useMetrics,
} from '@/hooks/queries/metrics'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { subMonths } from 'date-fns/subMonths'
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { MetricGroup } from './MetricGroup'

const TIME_INTERVALS = ['hour', 'day', 'week', 'month', 'year'] as const

const parseAsISODate = createParser({
  parse: (value) => {
    if (!value) return null
    const date = fromISODate(value)
    return isNaN(date.getTime()) ? null : date
  },
  serialize: (date) => toISODate(date),
})

interface CustomMetricsClientPageProps {
  organization: schemas['Organization']
}

export default function CustomMetricsClientPage({
  organization,
}: CustomMetricsClientPageProps) {
  const defaultStartDate = useMemo(() => subMonths(new Date(), 1), [])
  const defaultEndDate = useMemo(() => new Date(), [])

  const [interval] = useQueryState(
    'interval',
    parseAsStringLiteral(TIME_INTERVALS).withDefault('day'),
  )
  const [startDate] = useQueryState(
    'start_date',
    parseAsISODate.withDefault(defaultStartDate),
  )
  const [endDate] = useQueryState(
    'end_date',
    parseAsISODate.withDefault(defaultEndDate),
  )
  const [productId] = useQueryState('product_id', parseAsArrayOf(parseAsString))

  const { data: definitions, isLoading: definitionsLoading } =
    useMetricDefinitions(organization.id)

  const { isShown, show, hide } = useModal()

  const metricSlugs = useMemo(
    () => definitions?.map((d) => d.slug) ?? [],
    [definitions],
  )

  const { data } = useMetrics(
    {
      startDate,
      endDate,
      interval,
      organization_id: organization.id,
      ...(productId && productId.length > 0 ? { product_id: productId } : {}),
      metrics: metricSlugs.length > 0 ? metricSlugs : undefined,
    },
    metricSlugs.length > 0,
  )

  if (definitionsLoading) {
    return (
      <div className="dark:bg-polar-700 h-32 animate-pulse rounded-xl bg-gray-100" />
    )
  }

  if (!definitions || definitions.length === 0) {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="dark:border-polar-700 flex flex-col items-center justify-center rounded-2xl border border-gray-200 py-16 text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            No custom metrics yet
          </p>
          <p className="dark:text-polar-400 mt-2 text-sm text-gray-500">
            Create a custom metric backed by one of your usage meters.
          </p>
          <Button className="mt-6" onClick={show}>
            Create Metric
          </Button>
        </div>

        <InlineModal
          isShown={isShown}
          hide={hide}
          modalContent={
            <CreateMetricDefinitionContent
              organization={organization}
              onClose={hide}
            />
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-12">
      <div className="flex items-center justify-end">
        <Button variant="secondary" size="sm" onClick={show}>
          Add Metric
        </Button>
      </div>

      <MetricGroup
        metricKeys={metricSlugs as unknown as (keyof schemas['Metrics'])[]}
        data={data}
        interval={interval}
      />

      <DefinitionsList
        definitions={definitions}
        organizationId={organization.id}
      />

      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={
          <CreateMetricDefinitionContent
            organization={organization}
            onClose={hide}
          />
        }
      />
    </div>
  )
}

function DefinitionsList({
  definitions,
  organizationId,
}: {
  definitions: schemas['MetricDefinitionSchema'][]
  organizationId: string
}) {
  return (
    <div className="flex flex-col gap-y-2">
      <h3 className="dark:text-polar-400 text-sm font-medium text-gray-500">
        Manage Metrics
      </h3>
      {definitions.map((definition) => (
        <MetricDefinitionRow
          key={definition.id}
          definition={definition}
          organizationId={organizationId}
        />
      ))}
    </div>
  )
}

function MetricDefinitionRow({
  definition,
  organizationId,
}: {
  definition: schemas['MetricDefinitionSchema']
  organizationId: string
}) {
  const deleteMutation = useDeleteMetricDefinition(
    definition.id,
    organizationId,
  )

  const handleDelete = useCallback(() => {
    deleteMutation.mutate()
  }, [deleteMutation])

  return (
    <div className="dark:border-polar-700 dark:bg-polar-800 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-y-1">
        <span className="font-medium text-gray-900 dark:text-white">
          {definition.name}
        </span>
        <div className="flex items-center gap-x-2">
          <span className="dark:bg-polar-700 rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 dark:text-gray-300">
            {definition.slug}
          </span>
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Meter: {definition.meter.name}
          </span>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleDelete}
        loading={deleteMutation.isPending}
      >
        Delete
      </Button>
    </div>
  )
}

function CreateMetricDefinitionContent({
  organization,
  onClose,
}: {
  organization: schemas['Organization']
  onClose: () => void
}) {
  const createMutation = useCreateMetricDefinition(organization.id)
  const [selectedMeterId, setSelectedMeterId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ name: string; slug: string }>()

  const onSubmit = useCallback(
    async (data: { name: string; slug: string }) => {
      if (!selectedMeterId) return

      const result = await createMutation.mutateAsync({
        name: data.name,
        slug: data.slug,
        meter_id: selectedMeterId,
        organization_id: organization.id,
      })

      if (!result.error) {
        onClose()
      }
    },
    [createMutation, selectedMeterId, organization.id, onClose],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <InlineModalHeader hide={onClose}>
        <span>Create Custom Metric</span>
      </InlineModalHeader>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-y-6 px-8 pb-8"
      >
        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Name
          </label>
          <Input
            {...register('name', { required: 'Name is required' })}
            placeholder="e.g. API Calls"
          />
          {errors.name && (
            <span className="text-sm text-red-500">{errors.name.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Slug
          </label>
          <Input
            {...register('slug', {
              required: 'Slug is required',
              pattern: {
                value: /^[a-z0-9_]+$/,
                message:
                  'Only lowercase letters, numbers, and underscores allowed',
              },
            })}
            placeholder="e.g. api_calls"
          />
          {errors.slug && (
            <span className="text-sm text-red-500">{errors.slug.message}</span>
          )}
          <p className="dark:text-polar-400 text-xs text-gray-500">
            Unique identifier used in API queries. Cannot conflict with built-in
            metric slugs.
          </p>
        </div>

        <div className="flex flex-col gap-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Meter
          </label>
          <MeterSelector
            organizationId={organization.id}
            value={selectedMeterId}
            onChange={setSelectedMeterId}
            placeholder="Select a meter"
          />
          <p className="dark:text-polar-400 text-xs text-gray-500">
            The meter that provides data for this metric.
          </p>
        </div>

        <Button
          type="submit"
          loading={createMutation.isPending}
          disabled={!selectedMeterId}
          className="self-start"
        >
          Create Metric
        </Button>
      </form>
    </div>
  )
}
