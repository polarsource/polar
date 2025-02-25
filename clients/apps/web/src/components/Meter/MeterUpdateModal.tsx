import { useMeter, useUpdateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { useToast } from '../Toast/use-toast'
import MeterForm from './MeterForm'

export interface MeterUpdateModalProps {
  meter: schemas['Meter']
  hide: () => void
}

export const MeterUpdateModal = ({
  meter: _meter,
  hide,
}: MeterUpdateModalProps) => {
  const { data: meter } = useMeter(_meter.id, _meter)
  const form = useForm<schemas['MeterUpdate']>({
    defaultValues: meter,
  })

  const { handleSubmit, setError } = form
  const updateMeter = useUpdateMeter(_meter.id)
  const { toast } = useToast()

  const onSubmit = useCallback(
    async (body: schemas['MeterUpdate']) => {
      const { data: meter, error } = await updateMeter.mutateAsync(body)

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        }
        return
      }
      toast({
        title: `Meter ${meter.name} updated`,
        description: `Meter successfully updated.`,
      })

      hide()
    },
    [updateMeter, hide, toast, setError],
  )

  if (!meter) return null

  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <h2 className="text-xl">Edit Meter</h2>
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
            <div className="flex flex-row items-center gap-2">
              <Button type="submit">Update Meter</Button>
              <Button variant="secondary" onClick={hide}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
