import AccessRestricted from '@/components/Finance/AccessRestricted'
import { useHasPermission, useIsManagedAsCode } from '@/hooks/permissions'
import { useMeter, useUpdateMeter } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import {
  MANAGED_AS_CODE_MESSAGE,
  permissionDeniedMessage,
} from '@/utils/permissions'
import { isValidationError, schemas } from '@polar-sh/client'
import { Alert, Button, InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Well, WellContent, WellHeader } from '../Shared/Well'
import { useToast } from '../Toast/use-toast'
import MeterForm from './MeterForm'

export interface MeterUpdateModalProps {
  meter: schemas['Meter']
  hide: () => void
  hasProcessedEvents: boolean
  organizationId: string
}

export const MeterUpdateModal = ({
  meter: _meter,
  hide,
  hasProcessedEvents,
  organizationId,
}: MeterUpdateModalProps) => {
  const canManageProducts = useHasPermission(organizationId, 'products:manage')
  const managedAsCode = useIsManagedAsCode(organizationId)
  const { data: meter } = useMeter(_meter.id, { initialData: _meter })
  const form = useForm<schemas['MeterUpdate']>({
    defaultValues: {
      ...meter,
    },
  })

  const { handleSubmit, setError } = form
  const updateMeter = useUpdateMeter(_meter.id)
  const { toast } = useToast()
  const router = useRouter()

  const onSubmit = useCallback(
    async (body: schemas['MeterUpdate']) => {
      const allowedBody: schemas['MeterUpdate'] = hasProcessedEvents
        ? {
            name: body.name,
          }
        : body

      const { data: meter, error } = await updateMeter.mutateAsync(allowedBody)

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        return
      }
      toast({
        title: `Meter ${meter.name} updated`,
        description: `Meter successfully updated.`,
      })

      router.refresh()

      hide()
    },
    [router, hasProcessedEvents, updateMeter, hide, toast, setError],
  )

  const title = managedAsCode ? 'Meter' : 'Edit Meter'

  if (!canManageProducts && !managedAsCode) {
    return (
      <Box flexDirection="column" height="100%">
        <InlineModalHeader hide={hide}>
          <Text variant="heading-xxs" as="h2">
            {title}
          </Text>
        </InlineModalHeader>
        <Box flex={1} flexDirection="column" alignItems="center" padding="xl">
          <AccessRestricted
            message={permissionDeniedMessage('products:manage')}
          />
        </Box>
      </Box>
    )
  }

  if (!meter) return null

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <Text variant="heading-xxs" as="h2">
          {title}
        </Text>
      </InlineModalHeader>
      <div className="flex flex-col gap-8 px-8 pb-12">
        <p className="dark:text-polar-500 text-gray-500">
          Meters are aggregations of events. You can create a meter to track
          events that match a filter.
        </p>
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-8"
          >
            <Box
              as="fieldset"
              disabled={managedAsCode}
              flexDirection="column"
              rowGap="2xl"
            >
              <MeterForm
                organizationId={organizationId}
                readOnly={hasProcessedEvents || managedAsCode}
              />
            </Box>

            {managedAsCode ? (
              <Alert
                variant="info"
                title="Managed in code"
                description={MANAGED_AS_CODE_MESSAGE}
              />
            ) : (
              hasProcessedEvents && (
                <Well className="gap-y-2 rounded-2xl p-6">
                  <WellHeader>Updating Meter</WellHeader>
                  <WellContent>
                    <p className="dark:text-polar-500 text-sm text-gray-500">
                      Once a meter has processed events, its filters or
                      aggregation function cannot be changed.
                    </p>
                  </WellContent>
                </Well>
              )
            )}

            <div className="flex flex-row items-center gap-4">
              {!managedAsCode && (
                <Button type="submit" loading={updateMeter.isPending}>
                  Update Meter
                </Button>
              )}
              <Button variant="secondary" onClick={hide}>
                {managedAsCode ? 'Close' : 'Cancel'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
