import { CustomerCard } from '@/components/Customers/CustomerCard'
import { CatalogueTile } from '@/components/Home/CatalogueTile'
import { FinanceTile } from '@/components/Home/FinanceTile'
import { OrganizationTile } from '@/components/Home/OrganizationTile'
import { RevenueTile } from '@/components/Home/RevenueTile'
import { NotificationBadge } from '@/components/Notifications/NotificationBadge'
import { OrderRow } from '@/components/Orders/OrderRow'
import { Banner } from '@/components/Shared/Banner'
import { EmptyState } from '@/components/Shared/EmptyState'
import { MiniButton } from '@/components/Shared/MiniButton'
import PolarLogo from '@/components/Shared/PolarLogo'
import { ThemedText } from '@/components/Shared/ThemedText'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useCustomers } from '@/hooks/polar/customers'
import { useCreateNotificationRecipient } from '@/hooks/polar/notifications'
import { useOrders } from '@/hooks/polar/orders'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
import { useTheme } from '@/hooks/theme'
import { useStoreReview } from '@/hooks/useStoreReview'
import { useNotifications } from '@/providers/NotificationsProvider'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Link, Stack } from 'expo-router'
import {
  checkForUpdateAsync,
  fetchUpdateAsync,
  reloadAsync,
  useUpdates,
} from 'expo-updates'
import React, { useCallback, useContext, useEffect, useMemo } from 'react'
import {
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const { colors } = useTheme()

  const { isDownloading, isRestarting, isUpdateAvailable } = useUpdates()

  const {
    data: orders,
    refetch: refetchOrders,
    isRefetching: isRefetchingOrders,
  } = useOrders(organization?.id, {
    limit: 3,
  })

  const {
    data: subscriptions,
    refetch: refetchSubscriptions,
    isRefetching: isRefetchingSubscriptions,
  } = useSubscriptions(organization?.id, {
    limit: 3,
    active: true,
    sorting: ['-started_at'],
  })

  const {
    data: customers,
    refetch: refetchCustomers,
    isRefetching: isRefetchingCustomers,
  } = useCustomers(organization?.id, {
    limit: 5,
  })

  const flatOrders = useMemo(() => {
    return orders?.pages.flatMap((page) => page.items) ?? []
  }, [orders])

  const flatSubscriptions = useMemo(() => {
    return subscriptions?.pages.flatMap((page) => page.items) ?? []
  }, [subscriptions])

  const flatCustomers = useMemo(() => {
    return customers?.pages.flatMap((page) => page.items) ?? []
  }, [customers])

  const isRefetching = useMemo(() => {
    return (
      isRefetchingOrders || isRefetchingSubscriptions || isRefetchingCustomers
    )
  }, [isRefetchingOrders, isRefetchingSubscriptions, isRefetchingCustomers])

  const refresh = useCallback(() => {
    Promise.all([
      refetchOrders(),
      refetchCustomers(),
      refetchSubscriptions(),
      checkForUpdateAsync(),
    ])
  }, [refetchOrders, refetchCustomers, refetchSubscriptions])

  const { expoPushToken } = useNotifications()
  const { mutate: createNotificationRecipient } =
    useCreateNotificationRecipient()

  useEffect(() => {
    if (expoPushToken) {
      createNotificationRecipient(expoPushToken)
    }
  }, [expoPushToken, createNotificationRecipient])

  const { requestReview, shouldShow } = useStoreReview()

  useEffect(() => {
    const hasOrders = flatOrders.length > 0
    if (shouldShow(hasOrders)) {
      const timer = setTimeout(() => {
        requestReview()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [shouldShow, flatOrders.length, requestReview])

  async function onFetchUpdateAsync() {
    try {
      if (isUpdateAvailable) {
        await fetchUpdateAsync()
        await reloadAsync()
      }
    } catch (error) {
      // You can also add an alert() to see the error message in case of an error when fetching updates.
      alert(`Error fetching latest update: ${error}`)
    }
  }

  const safeAreaInsets = useSafeAreaInsets()

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: 48,
        backgroundColor: colors.background,
        gap: 32,
      }}
      refreshControl={
        <RefreshControl onRefresh={refresh} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          header: () => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.background,
                paddingTop: Platform.select({
                  ios: safeAreaInsets.top,
                  android: safeAreaInsets.top + 12,
                }),
                paddingBottom: 12,
                paddingHorizontal: 32,
              }}
            >
              <PolarLogo size={36} />
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <NotificationBadge />
                <Link href="/settings" asChild>
                  <TouchableOpacity activeOpacity={0.6}>
                    <MaterialIcons name="tune" size={24} color={colors.text} />
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          ),
          headerTitle: 'Home',
        }}
      />
      <View
        style={{
          padding: 16,
          gap: 32,
          flex: 1,
          flexDirection: 'column',
        }}
      >
        {isUpdateAvailable && (
          <Banner
            title="New Update Available"
            description="Update to the latest version to get the latest features and bug fixes"
            button={{
              onPress: onFetchUpdateAsync,
              children: 'Update',
              loading: isDownloading || isRestarting,
            }}
          />
        )}
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <OrganizationTile />
            </View>
            <View style={{ flex: 1 }}>
              <RevenueTile />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <CatalogueTile />
            </View>
            <View style={{ flex: 1 }}>
              <FinanceTile />
            </View>
          </View>
        </View>

        <Link href="/(authenticated)/(tabs)/test">
          <ThemedText>Test</ThemedText>
        </Link>

        <View style={{ gap: 24, flexDirection: 'column', flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <ThemedText style={{ fontSize: 20 }}>
              Recent Subscriptions
            </ThemedText>
            <Link href="/subscriptions" asChild>
              <MiniButton variant="secondary">View All</MiniButton>
            </Link>
          </View>
          {flatSubscriptions.length > 0 ? (
            <View style={{ gap: 8 }}>
              {flatSubscriptions.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  showCustomer
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No Subscriptions"
              description="No active subscriptions found for this organization"
            />
          )}
        </View>

        <View style={{ gap: 24, flexDirection: 'column', flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <ThemedText style={{ fontSize: 20 }}>Recent Orders</ThemedText>
            <Link href="/orders" asChild>
              <MiniButton variant="secondary">View All</MiniButton>
            </Link>
          </View>
          {flatOrders.length > 0 ? (
            <View style={{ gap: 8 }}>
              {flatOrders.map((order) => (
                <OrderRow key={order.id} order={order} showTimestamp />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No Orders"
              description="No orders found for this organization"
            />
          )}
        </View>
      </View>

      <View
        style={{
          gap: 24,
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
          }}
        >
          <ThemedText style={{ fontSize: 20 }}>Recent Customers</ThemedText>
          <Link href="/customers" asChild>
            <MiniButton variant="secondary">View All</MiniButton>
          </Link>
        </View>

        {flatCustomers && flatCustomers.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              gap: 16,
              paddingHorizontal: 16,
            }}
            contentOffset={{ x: -16, y: 0 }}
          >
            {flatCustomers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <EmptyState
              title="No Customers"
              description="No customers found for this organization"
            />
          </View>
        )}
      </View>
    </ScrollView>
  )
}
