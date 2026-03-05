'use client'

import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import { Form, FormField } from '@polar-sh/ui/components/ui/form'
import { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

export default function FeatureSettings({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const form = useForm<schemas['OrganizationFeatureSettings']>({
    defaultValues: organization.feature_settings || {},
  })
  const { control, setError, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSave = async (
    featureSettings: schemas['OrganizationFeatureSettings'],
  ) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        feature_settings: featureSettings,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }

      toast({
        title: 'Feature Settings Update Failed',
        description: `Error updating feature settings: ${error.detail}`,
      })

      return
    } else {
      if (data?.feature_settings) {
        reset(data.feature_settings)
      }
    }
  }

  useAutoSave({
    form,
    onSave,
    delay: 1000,
  })

  const [showSeatBasedModal, setShowSeatBasedModal] = useState(false)
  const seatBasedFieldRef = useRef<{ onChange: (value: boolean) => void }>(null)

  const memberModelEnabled =
    !!organization.feature_settings?.member_model_enabled
  const seatBasedAlreadyEnabled =
    !!organization.feature_settings?.seat_based_pricing_enabled

  const handleSeatBasedConfirm = useCallback(() => {
    seatBasedFieldRef.current?.onChange?.(true)
  }, [])

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <SettingsGroup>
          <SettingsGroupItem
            title="Cost Insights"
            description="Experimental feature to track costs and profits."
          >
            <FormField
              control={control}
              name="revops_enabled"
              render={({ field }) => {
                return (
                  <>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(enabled) => field.onChange(enabled)}
                    />
                  </>
                )
              }}
            />
          </SettingsGroupItem>
          <SettingsGroupItem
            title="Localized Checkout"
            description={
              <>
                Show{' '}
                <a
                  href="https://polar.sh/docs/features/checkout/localization"
                  target="_blank"
                  className="underline"
                  rel="noreferrer noopener"
                >
                  translated checkouts
                </a>{' '}
                to your customers.
              </>
            }
          >
            <FormField
              control={control}
              name="checkout_localization_enabled"
              render={({ field }) => {
                return (
                  <>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(enabled) => field.onChange(enabled)}
                    />
                  </>
                )
              }}
            />
          </SettingsGroupItem>
          <SettingsGroupItem
            title="Seat-Based Billing"
            description={
              <>
                Enable seat-based pricing for subscription products. Requires
                the member model to be enabled.
              </>
            }
          >
            <FormField
              control={control}
              name="seat_based_pricing_enabled"
              render={({ field }) => {
                seatBasedFieldRef.current = field
                return (
                  <>
                    <Switch
                      checked={field.value}
                      disabled={!memberModelEnabled || seatBasedAlreadyEnabled}
                      onCheckedChange={() => {
                        setShowSeatBasedModal(true)
                      }}
                    />
                  </>
                )
              }}
            />
          </SettingsGroupItem>
        </SettingsGroup>
      </form>

      <ConfirmModal
        isShown={showSeatBasedModal}
        hide={() => setShowSeatBasedModal(false)}
        title="Enable Seat-Based Billing"
        description="This action cannot be undone. Once enabled, seat-based billing cannot be disabled."
        body={
          <p className="text-sm">
            Please review the{' '}
            <a
              href="https://polar.sh/docs/guides/seat-based-pricing"
              target="_blank"
              className="underline"
              rel="noreferrer noopener"
            >
              seat-based pricing guide
            </a>{' '}
            before proceeding.
          </p>
        }
        onConfirm={handleSeatBasedConfirm}
      />
    </Form>
  )
}
