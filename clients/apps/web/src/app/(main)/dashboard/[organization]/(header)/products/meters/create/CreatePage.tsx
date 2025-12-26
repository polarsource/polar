'use client'

import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MeterForm from '@/components/Meter/MeterForm'
import { toast } from '@/components/Toast/use-toast'
import { useEvents } from '@/hooks/queries/events'
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
        `/dashboard/${organization.slug}/products/meters?selectedMeter=${meter.id}`,
      )
    },
    [setError, createMeter, organization.slug, router],
  )

  return (
    <DashboardBody
      title="Create Meter"
      header={
        <div className="hidden flex-row gap-x-4 md:flex">
          <Button onClick={handleSubmit(onSubmit)}>Create Meter</Button>
        </div>
      }
      className="flex h-full"
      wrapperClassName="w-full! max-w-(--breakpoint-2xl)!"
    >
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6 pb-8 xl:flex-row"
        >
          <div className="dark:xl:border-polar-700 flex h-full flex-1 flex-col gap-y-6 xl:w-1/2 xl:border-r xl:border-gray-100 xl:pr-12">
            <MeterForm organizationId={organization.id} />
            <Button
              className="self-start"
              onClick={updatePreview}
              loading={isPreviewLoading}
            >
              Preview
            </Button>
          </div>
          <div className="flex h-full flex-1 flex-col gap-y-6 xl:w-1/2 xl:pl-12">
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
