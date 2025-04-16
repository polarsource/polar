'use client'

import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MeterForm from '@/components/Meter/MeterForm'
import { toast } from '@/components/Toast/use-toast'
import { useEventNames, useEvents } from '@/hooks/queries/events'
import { useCreateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

export interface ClientPageProps {
  organization: schemas['Organization']
}

export default function ClientPage({ organization }: ClientPageProps) {
  const form = useForm<schemas['MeterCreate']>({
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
  const { handleSubmit, setError, getValues } = form
  const createMeter = useCreateMeter(organization.id)

  const router = useRouter()

  const [previewFilter, setPreviewFilter] = useState<string | null>(null)
  const { data: events, isLoading: isPreviewLoading } = useEvents(
    organization.id,
    {
      filter: previewFilter,
    },
    previewFilter !== null,
  )

  const updatePreview = useCallback(() => {
    const filter = getValues('filter')
    setPreviewFilter(filter ? JSON.stringify(filter) : null)
  }, [getValues])

  const { data: eventNames } = useEventNames(organization.id, {
    limit: 1,
    sorting: ['-occurrences'],
  })
  const flatEventNames = eventNames?.pages.flatMap((page) => page.items) ?? []

  const onSubmit = useCallback(
    async (body: schemas['MeterCreate']) => {
      const { data: meter, error } = await createMeter.mutateAsync(body)
      if (error) {
        if (error.detail) {
          setValidationErrors(error.detail, setError)
        }
        return
      }

      toast({
        title: `Meter ${meter.name} created`,
        description: `Meter successfully created.`,
      })

      router.push(
        `/dashboard/${organization.slug}/usage-billing/meters?selectedMeter=${meter.id}`,
      )
    },
    [createMeter, organization.slug, router],
  )

  return (
    <DashboardBody
      title="Create Meter"
      header={
        <div className="hidden flex-row gap-x-4 md:flex">
          <Button onClick={handleSubmit(onSubmit)}>Create Meter</Button>
        </div>
      }
      className="flex h-full flex-col gap-y-12"
      wrapperClassName="!w-full !h-full !max-w-full"
    >
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="dark:divide-polar-700 flex h-full w-full flex-col gap-y-6 divide-gray-200 md:flex-row md:divide-x"
        >
          <div className="flex h-full flex-1 flex-col gap-y-6 pb-8 md:w-1/2 md:pr-12">
            <MeterForm eventNames={flatEventNames} />
            <Button
              className="self-start"
              onClick={updatePreview}
              loading={isPreviewLoading}
            >
              Preview
            </Button>
          </div>
          <div className="flex h-full flex-1 flex-col gap-y-6 pb-8 md:w-1/2 md:pl-12">
            <div className="flex flex-col gap-y-4">
              <h2 className="text-xl">Preview</h2>
              <p className="dark:text-polar-500 text-gray-500">
                Preview the meter with the filter you created. Showing the
                latest 10 events.
              </p>
            </div>
            <Events events={events?.items ?? []} organization={organization} />
          </div>
          <div className="flex flex-row gap-x-4 md:hidden">
            <Button
              onClick={handleSubmit(onSubmit)}
              loading={createMeter.isPending}
            >
              Create Meter
            </Button>
          </div>
        </form>
      </Form>
    </DashboardBody>
  )
}
