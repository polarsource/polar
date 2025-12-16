import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useTheme } from '@/design-system/useTheme'
import {
  useSubscription,
  useUpdateSubscription,
} from '@/hooks/polar/subscriptions'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, RefreshControl, ScrollView } from 'react-native'

const CANCELLATION_REASONS = {
  unused: 'Unused',
  too_expensive: 'Too Expensive',
  missing_features: 'Missing Features',
  switched_service: 'Switched Service',
  customer_service: 'Customer Service',
  low_quality: 'Low Quality',
  too_complex: 'Too Complicated',
  other: 'Other',
} as const

const getHumanCancellationReason = (key: keyof typeof CANCELLATION_REASONS) => {
  if (key && key in CANCELLATION_REASONS) {
    return CANCELLATION_REASONS[key]
  }
  return null
}

type CancellationAction = 'revoke' | 'cancel_at_period_end'

type SubscriptionCancelForm = schemas['SubscriptionCancel'] & {
  cancellation_action: CancellationAction
}

export default function Index() {
  const { id } = useLocalSearchParams()
  const theme = useTheme()
  const router = useRouter()

  const {
    data: subscription,
    refetch,
    isRefetching,
  } = useSubscription(id as string)

  const cancelSubscription = useUpdateSubscription(id as string)
  const form = useForm<SubscriptionCancelForm>({
    defaultValues: {
      cancellation_action: 'cancel_at_period_end',
      customer_cancellation_reason: undefined,
    },
  })

  const { handleSubmit, setValue, watch } = form

  const cancellationAction = watch('cancellation_action')
  const cancellationReason = watch('customer_cancellation_reason')

  const onSubmit = useCallback(
    async (cancellation: SubscriptionCancelForm) => {
      const base = {
        customer_cancellation_reason: cancellation.customer_cancellation_reason,
      }
      let body: schemas['SubscriptionRevoke'] | schemas['SubscriptionCancel']
      if (cancellation.cancellation_action === 'revoke') {
        body = {
          ...base,
          revoke: true,
        }
      } else {
        body = {
          ...base,
          cancel_at_period_end: true,
        }
      }

      await cancelSubscription.mutateAsync(body).then(({ error }) => {
        if (error) {
          if (error.detail) {
            Alert.alert(
              'Customer Update Failed',
              `Error cancelling subscription ${subscription?.product.name}: ${error.detail}`,
            )
          }
          return
        }

        router.back()
      })
    },
    [subscription, cancelSubscription],
  )

  const reasons = Object.keys(
    CANCELLATION_REASONS,
  ) as (keyof typeof CANCELLATION_REASONS)[]

  if (!subscription) {
    return (
      <Stack.Screen
        options={{
          title: 'Cancel Subscription',
        }}
      />
    )
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        padding: theme.spacing['spacing-16'],
        backgroundColor: theme.colors.background,
      }}
      contentContainerStyle={{
        flexDirection: 'column',
        paddingBottom: theme.spacing['spacing-48'],
        gap: theme.spacing['spacing-16'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          title: 'Cancel Subscription',
        }}
      />
      <Box gap="spacing-24">
        <SubscriptionRow
          subscription={subscription}
          showCustomer
          style={{
            backgroundColor: theme.colors.card,
          }}
        />
        <Box
          flexDirection="row"
          gap="spacing-8"
          backgroundColor="card"
          padding="spacing-4"
          borderRadius="border-radius-12"
        >
          {['Immediately', 'End of Period'].map((option, index) => (
            <Touchable
              key={option}
              activeOpacity={0.6}
              style={[
                {
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingVertical: theme.spacing['spacing-10'],
                  paddingHorizontal: theme.spacing['spacing-8'],
                  borderRadius: theme.borderRadii['border-radius-8'],
                  flex: 1,
                },
                cancellationAction ===
                  (index === 0 ? 'revoke' : 'cancel_at_period_end') && {
                  backgroundColor: theme.colors.background,
                },
              ]}
              onPress={() => {
                setValue(
                  'cancellation_action',
                  index === 0 ? 'revoke' : 'cancel_at_period_end',
                )
              }}
            >
              <Text>{option}</Text>
            </Touchable>
          ))}
        </Box>

        <Box flex={1} gap="spacing-12">
          <Text>Customer Cancellation Reason</Text>
          <Box flex={1} gap="spacing-4">
            {reasons.map((reason) => (
              <Touchable
                key={reason}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing['spacing-8'],
                  backgroundColor: theme.colors.card,
                  height: theme.dimension['dimension-48'],
                  paddingHorizontal: theme.spacing['spacing-16'],
                  borderRadius: theme.borderRadii['border-radius-8'],
                }}
                onPress={() => {
                  setValue('customer_cancellation_reason', reason)
                }}
              >
                <Text>{getHumanCancellationReason(reason)}</Text>
                {cancellationReason === reason ? (
                  <Box>
                    <MaterialIcons
                      name="check"
                      size={20}
                      color={theme.colors.text}
                    />
                  </Box>
                ) : null}
              </Touchable>
            ))}
          </Box>
        </Box>
      </Box>
      <Button
        loading={cancelSubscription.isPending}
        disabled={cancelSubscription.isPending}
        onPress={handleSubmit(onSubmit)}
      >
        Cancel Subscription
      </Button>
    </ScrollView>
  )
}
