import { CustomerCard } from '@/components/Customers/CustomerCard'
import { AnimatedHeader } from '@/components/Home/AnimatedHeader'
import { CatalogueTile } from '@/components/Home/CatalogueTile'
import { FinanceTile } from '@/components/Home/FinanceTile'
import { OrganizationTile } from '@/components/Home/OrganizationTile'
import { RevenueTile } from '@/components/Home/RevenueTile'
import { OrderRow } from '@/components/Orders/OrderRow'
import { OrganizationsSheet } from '@/components/Settings/OrganizationsSheet'
import { Banner } from '@/components/Shared/Banner'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Text } from '@/components/Shared/Text'
import { SubscriptionRow } from '@/components/Subscriptions/SubscriptionRow'
import { useTheme } from '@/design-system/useTheme'
import { useCustomers } from '@/hooks/polar/customers'
import { useCreateNotificationRecipient } from '@/hooks/polar/notifications'
import { useOrders } from '@/hooks/polar/orders'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
import { useHomeHeaderHeight } from '@/hooks/useHomeHeaderHeight'
import { useStoreReview } from '@/hooks/useStoreReview'
import {
  AnimatedScrollProvider,
  useAnimatedScroll,
} from '@/providers/AnimatedScrollProvider'
import { useNotifications } from '@/providers/NotificationsProvider'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { Link, Stack } from 'expo-router'
import {
  checkForUpdateAsync,
  fetchUpdateAsync,
  reloadAsync,
  useUpdates,
} from 'expo-updates'
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { RefreshControl, ScrollView } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

export default function Index() {
  return (
    <AnimatedScrollProvider>
      <HomeContent />
    </AnimatedScrollProvider>
  )
}

function HomeContent() {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()
  const { scrollHandler, scrollViewRef } = useAnimatedScroll()
  const { grossHeaderHeight } = useHomeHeaderHeight()

  const { isDownloading, isRestarting, isUpdateAvailable } = useUpdates()

  const {
    data: orders,
    refetch: refetchOrders,
    isRefetching: isRefetchingOrders,
    isLoading: isLoadingOrders,
  } = useOrders(organization?.id, {
    limit: 3,
  })

  const {
    data: subscriptions,
    refetch: refetchSubscriptions,
    isRefetching: isRefetchingSubscriptions,
    isLoading: isLoadingSubscriptions,
  } = useSubscriptions(organization?.id, {
    limit: 3,
    active: true,
    sorting: ['-started_at'],
  })

  const {
    data: customers,
    refetch: refetchCustomers,
    isRefetching: isRefetchingCustomers,
    isLoading: isLoadingCustomers,
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

  const refresh = useCallback(async () => {
    await Promise.all([
      refetchOrders(),
      refetchCustomers(),
      refetchSubscriptions(),
    ])
    try {
      await checkForUpdateAsync()
    } catch {
      // checkForUpdateAsync is not supported on simulator/emulator
    }
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

  const [showOrganizationsSheet, setShowOrganizationsSheet] = useState(false)

  return (
    <GestureHandlerRootView>
      <Box flex={1} backgroundColor="background-regular">
        <Stack.Screen options={{ headerShown: false, title: 'Home' }} />
        <AnimatedHeader />
        <Animated.ScrollView
          ref={scrollViewRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: grossHeaderHeight,
            paddingBottom: theme.spacing['spacing-48'],
            backgroundColor: theme.colors['background-regular'],
            gap: theme.spacing['spacing-32'],
          }}
          refreshControl={
            <RefreshControl
              onRefresh={refresh}
              refreshing={isRefetching}
              progressViewOffset={grossHeaderHeight}
            />
          }
        >
          <Box
            padding="spacing-16"
            gap="spacing-32"
            flex={1}
            flexDirection="column"
          >
            {isUpdateAvailable ? (
              <Banner
                title="New Update Available"
                description="Update to the latest version to get the latest features and bug fixes"
              >
                <Button
                  onPress={onFetchUpdateAsync}
                  loading={isDownloading || isRestarting}
                >
                  Update
                </Button>
              </Banner>
            ) : null}
            <Box gap="spacing-16">
              <Box flexDirection="row" gap="spacing-16">
                <Box flex={1}>
                  <OrganizationTile
                    onPress={() => setShowOrganizationsSheet(true)}
                    loading={!organization}
                  />
                </Box>
                <Box flex={1}>
                  <RevenueTile loading={!organization} />
                </Box>
              </Box>
              <Box flexDirection="row" gap="spacing-16">
                <Box flex={1}>
                  <CatalogueTile loading={!organization} />
                </Box>
                <Box flex={1}>
                  <FinanceTile loading={!organization} />
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
                  <Button size="small" variant="secondary">
                    View All
                  </Button>
                </Link>
              </Box>
              {isLoadingSubscriptions ? (
                <Box gap="spacing-8">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <SubscriptionRow key={i} loading showCustomer />
                  ))}
                </Box>
              ) : flatSubscriptions.length > 0 ? (
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
                  <Button size="small" variant="secondary">
                    View All
                  </Button>
                </Link>
              </Box>
              {isLoadingOrders ? (
                <Box gap="spacing-8">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <OrderRow key={i} loading showTimestamp />
                  ))}
                </Box>
              ) : flatOrders.length > 0 ? (
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
                <Button size="small" variant="secondary">
                  View All
                </Button>
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
                {isLoadingCustomers
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <CustomerCard key={i} loading />
                    ))
                  : flatCustomers.map((customer) => (
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
        </Animated.ScrollView>

        {showOrganizationsSheet ? (
          <OrganizationsSheet
            onDismiss={() => setShowOrganizationsSheet(false)}
          />
        ) : null}
      </Box>
    </GestureHandlerRootView>
  )
}
