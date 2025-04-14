import { useEvents } from '@/hooks/queries/events'
import { useCreateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import MeterForm from './MeterForm'

export interface MeterCreationModalProps {
  organization: schemas['Organization']
  hide: () => void
}

export const MeterCreationModal = ({
  organization,
  hide,
}: MeterCreationModalProps) => {
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

  const [previewFilter, setPreviewFilter] = useState<string | null>(null)
  const { data: events } = useEvents(
    organization.id,
    {
      filter: previewFilter,
    },
    previewFilter !== null,
  )
  console.log(events) // TODO: show those events in the preview

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

      hide()
    },
    [createMeter, setError, hide],
  )

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="text-xl">Create Meter</h2>
      <p className="dark:text-polar-500 text-gray-500">
        Meters are aggregations of events. You can create a meter to track
        events that match a filter.
      </p>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-6"
          >
            <MeterForm />
            <Button type="submit">Create Meter</Button>
            <Button type="button" variant="secondary" onClick={updatePreview}>
              Preview
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
