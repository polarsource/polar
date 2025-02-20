'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MeterForm from '@/components/Meter/MeterForm'
import { useToast } from '@/components/Toast/use-toast'
import { useCreateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

const ClientPage = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const router = useRouter()
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
  const { handleSubmit, setError } = form
  const createMeter = useCreateMeter(organization.id)
  const { toast } = useToast()

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
        title: 'Meter Created',
        description: `Meter successfully created.`,
      })

      router.push(`/dashboard/${organization.slug}/meters/${meter.id}`)
    },
    [createMeter, router, organization, toast, setError],
  )

  return (
    <DashboardBody
      title="Create Meter"
      header={
        <Button
          type="submit"
          loading={createMeter.isPending}
          disabled={createMeter.isPending}
          onClick={handleSubmit(onSubmit)}
        >
          Create Meter
        </Button>
      }
      wide
    >
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
    </DashboardBody>
  )
}

export default ClientPage
