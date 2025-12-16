import { ProductPriceLabel } from '@/components/Products/ProductPriceLabel'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useTheme } from '@/design-system/useTheme'
import { useProducts } from '@/hooks/polar/products'
import {
  useSubscription,
  useUpdateSubscription,
} from '@/hooks/polar/subscriptions'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { hasLegacyRecurringPrices } from '@/utils/price'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { schemas } from '@polar-sh/client'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useContext, useEffect, useMemo } from 'react'
import { useForm, UseFormReturn } from 'react-hook-form'
import { Alert, RefreshControl, ScrollView } from 'react-native'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { id } = useLocalSearchParams()
  const theme = useTheme()
  const router = useRouter()

  const {
    data: subscription,
    refetch,
    isRefetching,
  } = useSubscription(id as string)

  const updateSubscription = useUpdateSubscription(id as string)

  const form = useForm<schemas['SubscriptionUpdateProduct']>({
    defaultValues: {
      proration_behavior: 'prorate',
    },
  })

  const { handleSubmit, watch, resetField, setValue } = form

  const { data: allProducts } = useProducts(organization?.id ?? '', {
    is_recurring: true,
    limit: 100,
    sorting: ['price_amount'],
    is_archived: false,
  })

  const products = useMemo(
    () =>
      allProducts
        ? allProducts.items.filter(
            (product) => !hasLegacyRecurringPrices(product),
          )
        : [],
    [allProducts],
  )

  const selectedProductId = watch('product_id')
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  )

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateProduct']) => {
      await updateSubscription.mutateAsync(body).then(({ error }) => {
        console.log({ error })
        if (error) {
          Alert.alert(
            'Subscription update failed',
            `Error while updating subscription ${
              subscription?.product.name
            }: ${JSON.stringify({ error })}`,
          )
          return
        }

        router.back()
      })
    },
    [updateSubscription, subscription],
  )

  // Set default proration behavior from organization settings
  useEffect(() => {
    if (organization) {
      resetField('proration_behavior', {
        defaultValue: organization.subscription_settings.proration_behavior,
      })
    }
  }, [organization, resetField])

  const productCandidates = useMemo(() => {
    return products.filter((product) => product.id !== subscription?.product_id)
  }, [products, subscription])

  if (!subscription) {
    return (
      <Stack.Screen
        options={{
          title: 'Update Subscription',
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
        paddingBottom: theme.spacing['spacing-48'],
        flexDirection: 'column',
        gap: theme.spacing['spacing-16'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          title: 'Update Subscription',
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

        <ProrationBehaviorSelector form={form} />

        <Box flex={1} gap="spacing-4">
          {productCandidates.length > 0 ? (
            productCandidates.map((product) => (
              <Touchable
                key={product.id}
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
                  setValue('product_id', product.id, { shouldDirty: true })
                }}
              >
                <Text>{product.name}</Text>
                <Box flexDirection="row" alignItems="center" gap="spacing-12">
                  <ProductPriceLabel product={product} />
                  <MaterialIcons
                    name="check"
                    size={16}
                    color={theme.colors.text}
                    style={{
                      opacity: product.id === selectedProductId ? 1 : 0,
                    }}
                  />
                </Box>
              </Touchable>
            ))
          ) : (
            <EmptyState
              title="No other products available"
              description="You have no other products to update to."
            />
          )}
        </Box>
      </Box>
      {selectedProduct && selectedProduct.id !== subscription.product.id ? (
        <Box
          backgroundColor="card"
          padding="spacing-16"
          borderRadius="border-radius-8"
        >
          <Text>
            The customer will get access to {selectedProduct.name} benefits, and
            lose access to {subscription.product.name} benefits.
          </Text>
        </Box>
      ) : null}
      <Button
        loading={updateSubscription.isPending}
        disabled={updateSubscription.isPending || !selectedProductId}
        onPress={handleSubmit(onSubmit)}
      >
        Update Subscription
      </Button>
    </ScrollView>
  )
}

const PRORATION_BEHAVIOR_LABELS: Record<
  schemas['SubscriptionProrationBehavior'],
  string
> = {
  invoice: 'Invoice Immediately',
  prorate: 'Prorate next Invoice',
}

const ProrationBehaviorSelector = ({
  form,
}: {
  form: UseFormReturn<schemas['SubscriptionUpdateProduct']>
}) => {
  const { watch, setValue } = form

  const prorationBehavior = watch('proration_behavior')

  return (
    <Box
      flexDirection="row"
      gap="spacing-8"
      backgroundColor="card"
      padding="spacing-4"
      borderRadius="border-radius-12"
    >
      {Object.entries(PRORATION_BEHAVIOR_LABELS).map(([key, label]) => (
        <Touchable
          key={key}
          activeOpacity={0.6}
          style={{ flex: 1 }}
          onPress={() => {
            setValue(
              'proration_behavior',
              key as schemas['SubscriptionProrationBehavior'],
              {
                shouldDirty: true,
              },
            )
          }}
        >
          <Box
            justifyContent="center"
            alignItems="center"
            backgroundColor={prorationBehavior === key ? 'background' : 'card'}
            paddingVertical="spacing-10"
            paddingHorizontal="spacing-8"
            borderRadius="border-radius-8"
            flex={1}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              textAlign="center"
              width="100%"
            >
              {label}
            </Text>
          </Box>
        </Touchable>
      ))}
    </Box>
  )
}
