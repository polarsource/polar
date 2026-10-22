import { AnimatedHeader } from '@/components/Home/AnimatedHeader'
import { CatalogueTile } from '@/components/Home/CatalogueTile'
import { DuoToolbar } from '@/components/Home/DuoToolbar'
import { FinanceTile } from '@/components/Home/FinanceTile'
import { LaptopDashboard } from '@/components/Home/LaptopDashboard'
import { OrganizationTile } from '@/components/Home/OrganizationTile'
import {
  RecentOrders,
  RecentSubscriptions,
} from '@/components/Home/RecentActivity'
import { RevenueTile } from '@/components/Home/RevenueTile'
import { WideDashboard } from '@/components/Home/WideDashboard'
import { OrganizationsSheet } from '@/components/Settings/OrganizationsSheet'
import { Box } from '@/components/Shared/Box'
import { LinkList } from '@/components/Shared/LinkList'
import { useTheme } from '@/design-system/useTheme'
import { useCustomers } from '@/hooks/polar/customers'
import { useCreateNotificationRecipient } from '@/hooks/polar/notifications'
import { useOrders } from '@/hooks/polar/orders'
import { useSubscriptions } from '@/hooks/polar/subscriptions'
import { useContentInsets } from '@/hooks/useContentInsets'
import { useHomeHeaderHeight } from '@/hooks/useHomeHeaderHeight'
import { useIsDuo } from '@/hooks/useIsDuo'
import { useStoreReview } from '@/hooks/useStoreReview'
import { foldProgress, useHinge } from '@/modules/duo-hinge'
import {
  AnimatedScrollProvider,
  useAnimatedScroll,
} from '@/providers/AnimatedScrollProvider'
import { useNotifications } from '@/providers/NotificationsProvider'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { Stack } from 'expo-router'
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { RefreshControl } from 'react-native'
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
  const { isMedium, isWide, paddingLeft, paddingRight } = useContentInsets()
  const isDuo = useIsDuo()
  const hinge = useHinge()
  const laptopDivision =
    hinge?.status === 'partiallyOpen' &&
    hinge.division &&
    hinge.division.width > hinge.division.height
      ? hinge.division
      : null

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
  } = useCustomers(organization?.id, {
    limit: 5,
  })

  const flatOrders = useMemo(() => {
    return orders?.pages.flatMap((page) => page.items) ?? []
  }, [orders])

  const flatSubscriptions = useMemo(() => {
    return subscriptions?.pages.flatMap((page) => page.items) ?? []
  }, [subscriptions])

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

  const [showOrganizationsSheet, setShowOrganizationsSheet] = useState(false)
  const openOrganizationsSheet = useCallback(
    () => setShowOrganizationsSheet(true),
    [],
  )

  return (
    <GestureHandlerRootView>
      <Box flex={1} backgroundColor="background-regular">
        <Stack.Screen
          options={{
            headerShown: false,
            title: 'Home',
            contentStyle: {
              backgroundColor: theme.colors.background,
              paddingLeft,
              paddingRight: isDuo ? 0 : paddingRight,
            },
          }}
        />
        {isDuo ? <DuoToolbar /> : null}
        <AnimatedHeader />
        {laptopDivision ? (
          <LaptopDashboard
            division={laptopDivision}
            foldProgress={foldProgress(hinge?.angle ?? Math.PI)}
            headerHeight={grossHeaderHeight}
            loading={!organization}
            loadingSubscriptions={isLoadingSubscriptions}
            loadingOrders={isLoadingOrders}
            subscriptions={flatSubscriptions}
            orders={flatOrders}
            subscriptionCount={subscriptions?.pages[0].pagination.total_count}
            orderCount={orders?.pages[0].pagination.total_count}
            customerCount={customers?.pages[0].pagination.total_count}
          />
        ) : (
          <Animated.ScrollView
            ref={scrollViewRef}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingTop: grossHeaderHeight,
              paddingBottom: theme.spacing['spacing-48'],
              backgroundColor: theme.colors['background-regular'],
            }}
            refreshControl={
              <RefreshControl
                onRefresh={refresh}
                refreshing={isRefetching}
                progressViewOffset={grossHeaderHeight}
              />
            }
          >
            {isMedium ? (
              <WideDashboard
                stackLists={!isWide}
                loading={!organization}
                loadingSubscriptions={isLoadingSubscriptions}
                loadingOrders={isLoadingOrders}
                subscriptions={flatSubscriptions}
                orders={flatOrders}
                subscriptionCount={
                  subscriptions?.pages[0].pagination.total_count
                }
                orderCount={orders?.pages[0].pagination.total_count}
                customerCount={customers?.pages[0].pagination.total_count}
                onOrganizationPress={openOrganizationsSheet}
              />
            ) : (
              <Box
                padding="spacing-16"
                gap="spacing-32"
                flex={1}
                flexDirection="column"
              >
                <Box gap="spacing-16">
                  <Box flexDirection="row" gap="spacing-16">
                    <Box flex={1}>
                      <OrganizationTile
                        onPress={openOrganizationsSheet}
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
                <RecentSubscriptions
                  subscriptions={flatSubscriptions}
                  loading={isLoadingSubscriptions}
                />
                <RecentOrders orders={flatOrders} loading={isLoadingOrders} />
                <LinkList
                  items={[
                    {
                      title: 'Customers',
                      meta: `${customers?.pages[0].pagination.total_count}`,
                      link: '/customers',
                    },
                    {
                      title: 'Products',
                      link: '/products',
                    },
                    {
                      title: 'Subscriptions',
                      link: '/subscriptions',
                    },
                    {
                      title: 'Checkout Links',
                      link: '/checkout-links',
                    },
                  ]}
                />
              </Box>
            )}
          </Animated.ScrollView>
        )}

        {showOrganizationsSheet ? (
          <OrganizationsSheet
            onDismiss={() => setShowOrganizationsSheet(false)}
          />
        ) : null}
      </Box>
    </GestureHandlerRootView>
  )
}
