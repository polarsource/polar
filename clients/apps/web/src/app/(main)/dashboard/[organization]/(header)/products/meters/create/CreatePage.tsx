'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import MeterForm from '@/components/Meter/MeterForm'
import { toast } from '@/components/Toast/use-toast'
import { useCreateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
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
  const { handleSubmit, setError } = form
  const createMeter = useCreateMeter(organization.id)

  const router = useRouter()

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
      wrapperClassName="max-w-2xl!"
    >
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6 pb-8 xl:flex-row"
        >
          <div className="flex flex-1 flex-col gap-y-6">
            <MeterForm organizationId={organization.id} />
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
