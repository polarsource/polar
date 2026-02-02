import { useUpdateOrganization } from '@/hooks/queries'
import { useAutoSave } from '@/hooks/useAutoSave'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@spaire/client'
import Switch from '@spaire/ui/components/atoms/Switch'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@spaire/ui/components/ui/form'
import React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { BenefitRevocationGracePeriod } from './BenefitRevocationGracePeriod'
import { ProrationBehavior } from './ProrationBehavior'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'

interface OrganizationSubscriptionSettingsProps {
  organization: schemas['Organization']
}

const OrganizationSubscriptionSettings: React.FC<
  OrganizationSubscriptionSettingsProps
> = ({ organization }) => {
  const form = useForm<schemas['OrganizationSubscriptionSettings']>({
    defaultValues: organization.subscription_settings,
  })
  const { control, setError, reset } = form

  const updateOrganization = useUpdateOrganization()
  const onSave = async (
    subscription_settings: schemas['OrganizationSubscriptionSettings'],
  ) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        subscription_settings,
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        setError('root', { message: error.detail })
      }

      toast({
        title: 'Subscription Settings Update Failed',
        description: `Error updating subscription settings: ${error.detail}`,
      })

      return
    }

    reset(data.subscription_settings)
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
            title="Allow multiple subscriptions"
            description="Customers can have multiple active subscriptions at the same time."
          >
            <FormField
              control={control}
              name="allow_multiple_subscriptions"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Proration"
            description="Determines how to bill customers when they change their subscription"
          >
            <FormField
              control={control}
              name="proration_behavior"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ProrationBehavior
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Grace period for benefit revocation"
            description="How long to wait before revoking benefits during payment retries"
          >
            <FormField
              control={control}
              name="benefit_revocation_grace_period"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <BenefitRevocationGracePeriod
                      value={field.value}
                      onValueChange={(value) => field.onChange(Number(value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>

          <SettingsGroupItem
            title="Prevent trial abuse"
            description="When enabled, customers who previously had a trial on any of your products won't be eligible for another trial."
          >
            <FormField
              control={control}
              name="prevent_trial_abuse"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroupItem>
        </SettingsGroup>
      </form>
    </Form>
  )
}

export default OrganizationSubscriptionSettings
