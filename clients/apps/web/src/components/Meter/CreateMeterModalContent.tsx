import { useCreateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { useToast } from '../Toast/use-toast'
import MeterForm from './MeterForm'

interface CreateMeterModalContentProps {
  organization: schemas['Organization']
  onSelectMeter: (meter: schemas['Meter']) => void
  hideModal: () => void
}

const CreateMeterModalContent = ({
  organization,
  hideModal,
  onSelectMeter,
}: CreateMeterModalContentProps) => {
  const { toast } = useToast()

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

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const createMeter = useCreateMeter(organization.id)

  const handleCreateNewMeter = useCallback(
    async (body: schemas['MeterCreate']) => {
      const { data: meter, error } = await createMeter.mutateAsync(body)
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        return
      }

      toast({
        title: `Meter ${meter.name} created`,
        description: `Meter successfully created.`,
      })

      onSelectMeter(meter)
      hideModal()
    },
    [createMeter, hideModal, onSelectMeter, setError, toast],
  )

  return (
    <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
      <div>
        <h2 className="text-lg">Create Meter</h2>
        <div className="dark:text-polar-500 mt-2 space-y-2 text-sm text-gray-500">
          <p>
            Meters are aggregated filters on ingested events. They are used to
            calculate your customer&apos;s usage of whatever you choose to
            measure.
          </p>
          <p>
            For example, if you want to measure the number of API calls your
            customer makes, you can create a meter that counts the number of
            events with an arbitrary name like <code>api_call</code>.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form className="flex flex-col gap-y-6">
            <MeterForm organizationId={organization.id} />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="button"
                loading={createMeter.isPending}
                disabled={createMeter.isPending || !form.formState.isValid}
                onClick={handleSubmit(handleCreateNewMeter)}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                onClick={hideModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default CreateMeterModalContent
