import { CustomerCard } from '@/components/Customers/CustomerCard'
import { CatalogueTile } from '@/components/Home/CatalogueTile'
import { FinanceTile } from '@/components/Home/FinanceTile'
import { OrganizationTile } from '@/components/Home/OrganizationTile'
import { RevenueTile } from '@/components/Home/RevenueTile'
import { NotificationBadge } from '@/components/Notifications/NotificationBadge'
import { OrderRow } from '@/components/Orders/OrderRow'
import { Banner } from '@/components/Shared/Banner'
import { Box } from '@/components/Shared/Box'
import { EmptyState } from '@/components/Shared/EmptyState'
import { MiniButton } from '@/components/Shared/MiniButton'
import PolarLogo from '@/components/Shared/PolarLogo'
import { Text } from '@/components/Shared/Text'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useTheme } from '@/design-system/useTheme'
import { useCustomers } from '@/hooks/polar/customers'
import { useCreateNotificationRecipient } from '@/hooks/polar/notifications'
import { useOrders } from '@/hooks/polar/orders'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function Index() {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()

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
      alert(`Error fetching latest update: ${error}`)
    }
  }

  const safeAreaInsets = useSafeAreaInsets()

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: theme.spacing['spacing-48'],
        backgroundColor: theme.colors['background-regular'],
        gap: theme.spacing['spacing-32'],
      }}
      refreshControl={
        <RefreshControl onRefresh={refresh} refreshing={isRefetching} />
      }
    >
      <Stack.Screen
        options={{
          header: () => (
            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              backgroundColor="background-regular"
              paddingBottom="spacing-12"
              paddingHorizontal="spacing-32"
              style={{
                paddingTop: Platform.select({
                  ios: safeAreaInsets.top,
                  android: safeAreaInsets.top + theme.spacing['spacing-12'],
                }),
              }}
            >
              <PolarLogo size={36} />
              <Box flexDirection="row" gap="spacing-20">
                <NotificationBadge />
                <Link href="/settings" asChild>
                  <TouchableOpacity activeOpacity={0.6}>
                    <MaterialIcons
                      name="tune"
                      size={24}
                      color={theme.colors['foreground-regular']}
                    />
                  </TouchableOpacity>
                </Link>
              </Box>
            </Box>
          ),
          headerTitle: 'Home',
        }}
      />
      <Box
        padding="spacing-16"
        gap="spacing-32"
        flex={1}
        flexDirection="column"
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
        <Box gap="spacing-16">
          <Box flexDirection="row" gap="spacing-16">
            <Box flex={1}>
              <OrganizationTile />
            </Box>
            <Box flex={1}>
              <RevenueTile />
            </Box>
          </Box>
          <Box flexDirection="row" gap="spacing-16">
            <Box flex={1}>
              <CatalogueTile />
            </Box>
            <Box flex={1}>
              <FinanceTile />
            </Box>
          </Box>
        </Box>

        <Box gap="spacing-24" flexDirection="column" flex={1}>
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text variant="title">Recent Subscriptions</Text>
            <Link href="/subscriptions" asChild>
              <MiniButton variant="secondary">View All</MiniButton>
            </Link>
          </Box>
          {flatSubscriptions.length > 0 ? (
            <Box gap="spacing-8">
              {flatSubscriptions.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  showCustomer
                />
              ))}
            </Box>
          ) : (
            <EmptyState
              title="No Subscriptions"
              description="No active subscriptions found for this organization"
            />
          )}
        </Box>

        <Box gap="spacing-24" flexDirection="column" flex={1}>
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text variant="title">Recent Orders</Text>
            <Link href="/orders" asChild>
              <MiniButton variant="secondary">View All</MiniButton>
            </Link>
          </Box>
          {flatOrders.length > 0 ? (
            <Box gap="spacing-8">
              {flatOrders.map((order) => (
                <OrderRow key={order.id} order={order} showTimestamp />
              ))}
            </Box>
          ) : (
            <EmptyState
              title="No Orders"
              description="No orders found for this organization"
            />
          )}
        </Box>
      </Box>

      <Box gap="spacing-24" flexDirection="column" flex={1}>
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="spacing-16"
        >
          <Text variant="title">Recent Customers</Text>
          <Link href="/customers" asChild>
            <MiniButton variant="secondary">View All</MiniButton>
          </Link>
        </Box>

        {flatCustomers && flatCustomers.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              gap: theme.spacing['spacing-16'],
              paddingHorizontal: theme.spacing['spacing-16'],
            }}
            contentOffset={{ x: -theme.spacing['spacing-16'], y: 0 }}
          >
            {flatCustomers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </ScrollView>
        ) : (
          <Box flex={1} paddingHorizontal="spacing-16">
            <EmptyState
              title="No Customers"
              description="No customers found for this organization"
            />
          </Box>
        )}
      </Box>
    </ScrollView>
  )
}
