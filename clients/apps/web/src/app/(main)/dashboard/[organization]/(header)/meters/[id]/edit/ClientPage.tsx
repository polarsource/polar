'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MeterForm from '@/components/Meter/MeterForm'
import { useToast } from '@/components/Toast/use-toast'
import { useMeter, useUpdateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import {
  Meter,
  MeterUpdate,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

const ClientPage = ({
  meter: _meter,
  organization,
}: {
  meter: Meter
  organization: Organization
}) => {
  const router = useRouter()
  const { data: meter } = useMeter(_meter.id, _meter)
  const form = useForm<MeterUpdate>({
    defaultValues: meter,
  })
  const { handleSubmit, setError } = form
  const updateMeter = useUpdateMeter(_meter.id)
  const { toast } = useToast()

  const onSubmit = useCallback(
    async (body: MeterUpdate) => {
      try {
        const meter = await updateMeter.mutateAsync(body)
        toast({
          title: 'Meter Updated',
          description: `Meter successfully updated.`,
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
    [updateMeter, router, organization, toast, setError],
  )

  if (!meter) return null

  return (
    <DashboardBody
      title={`Edit ${meter.name}`}
      header={
        <Button
          type="submit"
          loading={updateMeter.isPending}
          disabled={updateMeter.isPending}
          onClick={handleSubmit(onSubmit)}
        >
          Update Meter
        </Button>
      }
    >
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <MeterForm />
        </form>
      </Form>
    </DashboardBody>
  )
}

export default ClientPage
