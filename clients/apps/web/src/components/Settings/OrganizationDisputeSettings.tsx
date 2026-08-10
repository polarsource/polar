import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Switch } from '@polar-sh/orbit'
import MoneyInput from '@polar-sh/ui/components/atoms/MoneyInput'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationDisputeSettingsProps {
  organization: schemas['Organization']
  readOnly: boolean
}

// Mirrors DISPUTE_AUTO_ACCEPT_MAX_AMOUNT on the server.
const MAX_AMOUNT = 10_000

const format = formatCurrency('accounting')

const OrganizationDisputeSettings: React.FC<
  OrganizationDisputeSettingsProps
> = ({ organization, readOnly }) => {
  const form = useForm<schemas['OrganizationDisputeSettings']>({
    defaultValues: organization.dispute_settings,
  })
  const { control, setError, setValue, clearErrors, reset } = form
  const [enabled, setEnabled] = React.useState(
    organization.dispute_settings.auto_accept_below_amount !== null,
  )

  const updateOrganization = useUpdateOrganization()
  const onSave = async (
    dispute_settings: schemas['OrganizationDisputeSettings'],
  ) => {
    // useAutoSave saves without validating, so the ceiling would only be
    // caught by the API — in cents, which is not what the field shows.
    if (!(await form.trigger())) {
      return
    }

    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        dispute_settings,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }

      toast({
        title: 'Dispute Settings Update Failed',
        description: `Error updating dispute settings: ${extractApiErrorMessage(error)}`,
      })

      return
    }

    reset(data.dispute_settings)
  }

  useAutoSave({
    form,
    onSave,
    delay: 1000,
  })

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <SettingsGroup>
          <SettingsGroupItem
            title="Accept small disputes"
            description="Polar concedes them for you, a day after they open, unless you reply first. The disputed amount and the processor's dispute fee are still deducted."
          >
            <Switch
              checked={enabled}
              disabled={readOnly}
              onCheckedChange={(checked) => {
                setEnabled(checked)
                if (checked) {
                  clearErrors('auto_accept_below_amount')
                } else {
                  setValue('auto_accept_below_amount', null, {
                    shouldDirty: true,
                  })
                }
              }}
            />
          </SettingsGroupItem>

          {enabled && (
            <SettingsGroupItem
              title="Up to"
              description={`Whole dollars, up to ${format(MAX_AMOUNT, 'usd')}. A dispute charged in another currency is converted.`}
            >
              <FormField
                control={control}
                name="auto_accept_below_amount"
                rules={{
                  max: {
                    value: MAX_AMOUNT,
                    message: `Enter an amount up to ${format(MAX_AMOUNT, 'usd')}.`,
                  },
                  validate: (value) => {
                    if (!enabled) {
                      return true
                    }
                    if (!value) {
                      return 'Set an amount, or turn this off.'
                    }
                    return value % 100 === 0 || 'Use whole dollars.'
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MoneyInput
                        name={field.name}
                        currency="usd"
                        placeholder={2500}
                        step={1}
                        value={field.value}
                        disabled={readOnly}
                        onChange={(value) => field.onChange(value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsGroupItem>
          )}
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationDisputeSettings
