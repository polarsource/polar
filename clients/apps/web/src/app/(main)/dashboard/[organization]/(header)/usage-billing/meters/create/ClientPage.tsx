'use client'

import { Events } from '@/components/Events/Events'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MeterForm from '@/components/Meter/MeterForm'
import {
  Well,
  WellContent,
  WellFooter,
  WellHeader,
} from '@/components/Shared/Well'
import { toast } from '@/components/Toast/use-toast'
import { useEvents } from '@/hooks/queries/events'
import { useCreateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
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
  const { data: events } = useEvents(
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
        `/dashboard/${organization.slug}/usage-billing/meters?selectedMeter=${meter.id}`,
      )
    },
    [createMeter, organization.slug, router],
  )

  return (
    <DashboardBody
      title="Create Meter"
      header={
        <div className="flex flex-row gap-x-4">
          <Button type="button" variant="secondary" onClick={updatePreview}>
            Preview
          </Button>
          <Button onClick={handleSubmit(onSubmit)}>Create Meter</Button>
        </div>
      }
      className="flex flex-col gap-y-12"
      wrapperClassName="!max-w-screen-md"
    >
      <Well>
        <WellHeader className="text-lg leading-none">Product Meters</WellHeader>
        <WellContent>
          <p className="dark:text-polar-500 text-gray-500">
            Meters are aggregations of events that match a filter. Meters can be
            attached to subscription products with an associated unit price.
          </p>
        </WellContent>
        <WellFooter>
          <Link href="https://docs.polar.sh/features/usage-billing">
            <Button size="sm">Read the documentation</Button>
          </Link>
        </WellFooter>
      </Well>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-6"
          >
            <MeterForm />
          </form>
        </Form>
      </div>
      <div className="flex flex-col gap-y-6">
        <h2 className="text-xl">Preview</h2>
        <p className="dark:text-polar-500 text-gray-500">
          Preview the meter with the filter you created.
        </p>
        <Events events={events?.items ?? []} organization={organization} />
      </div>
    </DashboardBody>
  )
}
