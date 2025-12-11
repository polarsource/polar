import { SelectionSheet } from '@/components/Settings/SelectionSheet'
import { SettingsItem } from '@/components/Settings/SettingsList'
import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import {
  useOrganization,
  useUpdateOrganization,
} from '@/hooks/polar/organizations'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { schemas } from '@polar-sh/client'
import { Stack } from 'expo-router'
import { useCallback, useContext, useState } from 'react'
import { RefreshControl, ScrollView, Switch } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const PRORATION_BEHAVIOR_LABELS: Record<
  schemas['SubscriptionProrationBehavior'],
  string
> = {
  invoice: 'Invoice Immediately',
  prorate: 'Prorate next Invoice',
}

const BENEFIT_REVOCATION_LABELS: Record<
  schemas['OrganizationSubscriptionSettings']['benefit_revocation_grace_period'],
  string
> = {
  0: 'Immediate',
  2: '2 Days',
  7: '7 Days',
  14: '14 Days',
  21: '21 Days',
}

export default function SubscriptionSettingsPage() {
  const theme = useTheme()

  const { organization } = useContext(OrganizationContext)
  const {
    refetch: refetchOrganization,
    isRefetching: isRefetchingOrganization,
  } = useOrganization()

  const { mutateAsync: updateOrganization } = useUpdateOrganization()

  const createSubscriptionSettingHandler = useCallback(
    <T,>(key: keyof schemas['OrganizationSubscriptionSettings']) =>
      async (value: T) => {
        if (!organization?.id) {
          return
        }

        await updateOrganization({
          organizationId: organization?.id,
          update: {
            subscription_settings: {
              ...organization?.subscription_settings,
              [key]: value,
            },
          },
        })
      },
    [organization, updateOrganization],
  )

  const [prorationBehaviorSheetOpen, setProrationBehaviorSheetOpen] =
    useState(false)
  const [benefitRevocationSheetOpen, setBenefitRevocationSheetOpen] =
    useState(false)

  return (
    <GestureHandlerRootView>
      <Stack.Screen options={{ title: 'Subscriptions' }} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingOrganization}
            onRefresh={refetchOrganization}
          />
        }
        contentContainerStyle={{
          padding: theme.spacing['spacing-16'],
        }}
      >
        <SettingsItem
          title="Allow Multiple Subscriptions"
          description="Customers can have multiple active subscriptions at the same time"
          variant="static"
        >
          <Switch
            value={
              organization?.subscription_settings.allow_multiple_subscriptions
            }
            onValueChange={createSubscriptionSettingHandler(
              'allow_multiple_subscriptions',
            )}
          />
        </SettingsItem>
        <SettingsItem
          title="Allow Price Changes"
          description="Customers can switch their subscription's price from the customer portal"
          variant="static"
        >
          <Switch
            value={organization?.subscription_settings.allow_customer_updates}
            onValueChange={createSubscriptionSettingHandler(
              'allow_customer_updates',
            )}
          />
        </SettingsItem>

        <SettingsItem
          title="Prevent Trial Abuse"
          description="Prevents customers who previously had a trial from getting another trial"
          variant="static"
        >
          <Switch
            value={organization?.subscription_settings.prevent_trial_abuse}
            onValueChange={createSubscriptionSettingHandler(
              'prevent_trial_abuse',
            )}
          />
        </SettingsItem>
        <Box height={1} backgroundColor="border" marginVertical="spacing-8" />
        <SettingsItem
          title="Proration Behavior"
          variant="select"
          onPress={() => {
            setProrationBehaviorSheetOpen(true)
          }}
        >
          <Text variant="bodySmall">
            {
              PRORATION_BEHAVIOR_LABELS[
                organization?.subscription_settings.proration_behavior ??
                  'prorate'
              ]
            }
          </Text>
        </SettingsItem>
        <SettingsItem
          title="Benefit Revocation"
          variant="select"
          onPress={() => {
            setBenefitRevocationSheetOpen(true)
          }}
        >
          <Text variant="bodySmall">
            {
              BENEFIT_REVOCATION_LABELS[
                organization?.subscription_settings
                  .benefit_revocation_grace_period ?? 0
              ]
            }
          </Text>
        </SettingsItem>
      </ScrollView>

      {prorationBehaviorSheetOpen ? (
        <SelectionSheet
          title="Proration Behavior"
          description="Determines how to bill customers when they change their subscription"
          items={Object.entries(PRORATION_BEHAVIOR_LABELS).map(
            ([key, label]) => ({
              value: key,
              label,
            }),
          )}
          onSelect={createSubscriptionSettingHandler('proration_behavior')}
          selectedValue={organization?.subscription_settings.proration_behavior}
          onDismiss={() => setProrationBehaviorSheetOpen(false)}
        />
      ) : null}
      {benefitRevocationSheetOpen ? (
        <SelectionSheet
          snapPoints={['100%']}
          title="Grace Period for Benefit Revocation"
          description="How long to wait before revoking benefits during payment retries"
          items={Object.entries(BENEFIT_REVOCATION_LABELS).map(
            ([key, label]) => ({
              value: Number(key),
              label,
            }),
          )}
          selectedValue={
            organization?.subscription_settings.benefit_revocation_grace_period
          }
          onSelect={createSubscriptionSettingHandler(
            'benefit_revocation_grace_period',
          )}
          onDismiss={() => setBenefitRevocationSheetOpen(false)}
        />
      ) : null}
    </GestureHandlerRootView>
  )
}
