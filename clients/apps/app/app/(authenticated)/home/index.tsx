import { OrderRow } from "@/components/Orders/OrderRow";
import { useOrders } from "@/hooks/polar/orders";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Link, Stack } from "expo-router";
import { useCallback, useContext, useEffect, useMemo } from "react";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { RevenueTile } from "@/components/Home/RevenueTile";
import { OrganizationTile } from "@/components/Home/OrganizationTile";
import { useTheme } from "@/hooks/theme";
import PolarLogo from "@/components/Shared/PolarLogo";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { useCreateNotificationRecipient } from "@/hooks/polar/notifications";
import { useNotifications } from "@/providers/NotificationsProvider";
import { useCustomers } from "@/hooks/polar/customers";
import { CustomerCard } from "@/components/Customers/CustomerCard";
import React from "react";
import { NotificationBadge } from "@/components/Notifications/NotificationBadge";
import { isDemoSession, useLogout } from "@/hooks/auth";
import { EmptyState } from "@/components/Shared/EmptyState";
import {
  checkForUpdateAsync,
  fetchUpdateAsync,
  reloadAsync,
  useUpdates,
} from "expo-updates";
import { Banner } from "@/components/Shared/Banner";
import { useSubscriptions } from "@/hooks/polar/subscriptions";
import { SubscriptionRow } from "@/components/Subscriptions/SubscriptionRow";
import { ThemedText } from "@/components/Shared/ThemedText";
import { MiniButton } from "@/components/Shared/MiniButton";
import { CatalogueTile } from "@/components/Home/CatalogueTile";
import { FinanceTile } from "@/components/Home/FinanceTile";
import { MotiView } from "moti";

export default function Index() {
  const { organization } = useContext(OrganizationContext);
  const { colors } = useTheme();

  const { isDownloading, isRestarting, isUpdateAvailable } = useUpdates();

  const {
    data: orders,
    refetch: refetchOrders,
    isRefetching: isRefetchingOrders,
  } = useOrders(organization?.id, {
    limit: 3,
  });

  const {
    data: subscriptions,
    refetch: refetchSubscriptions,
    isRefetching: isRefetchingSubscriptions,
  } = useSubscriptions(organization?.id, {
    limit: 3,
    active: true,
    sorting: ["-started_at"],
  });

  const {
    data: customers,
    refetch: refetchCustomers,
    isRefetching: isRefetchingCustomers,
  } = useCustomers(organization?.id, {
    limit: 5,
  });

  const flatOrders = useMemo(() => {
    return orders?.pages.flatMap((page) => page.result.items) ?? [];
  }, [orders]);

  const flatSubscriptions = useMemo(() => {
    return subscriptions?.pages.flatMap((page) => page.result.items) ?? [];
  }, [subscriptions]);

  const flatCustomers = useMemo(() => {
    return customers?.pages.flatMap((page) => page.result.items) ?? [];
  }, [customers]);

  const isRefetching = useMemo(() => {
    return (
      isRefetchingOrders || isRefetchingSubscriptions || isRefetchingCustomers
    );
  }, [isRefetchingOrders, isRefetchingSubscriptions, isRefetchingCustomers]);

  const refresh = useCallback(() => {
    Promise.all([
      refetchOrders(),
      refetchCustomers(),
      refetchSubscriptions(),
      checkForUpdateAsync(),
    ]);
  }, [refetchOrders, refetchCustomers, refetchSubscriptions]);

  const { expoPushToken } = useNotifications();
  const { mutate: createNotificationRecipient } =
    useCreateNotificationRecipient();

  const isDemo = isDemoSession();

  useEffect(() => {
    if (expoPushToken && !isDemo) {
      createNotificationRecipient(expoPushToken);
    }
  }, [expoPushToken, createNotificationRecipient, isDemo]);

  async function onFetchUpdateAsync() {
    try {
      if (isUpdateAvailable) {
        await fetchUpdateAsync();
        await reloadAsync();
      }
    } catch (error) {
      // You can also add an alert() to see the error message in case of an error when fetching updates.
      alert(`Error fetching latest update: ${error}`);
    }
  }

  const tileAnimationProps = useCallback((delay: number) => {
    return {
      style: {
        flex: 1,
      },
      from: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { type: "timing", duration: 500, delay },
    } as const;
  }, []);

  return (
    <ScrollView
      contentContainerStyle={{ backgroundColor: colors.background, gap: 32 }}
      refreshControl={
        <RefreshControl onRefresh={refresh} refreshing={isRefetching} />
      }
      contentInset={{ bottom: 48 }}
    >
      <Stack.Screen
        options={{
          header: () => (
            <SafeAreaView
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.background,
                height: 100,
                marginHorizontal: 32,
              }}
            >
              <PolarLogo size={36} />
              <View style={{ flexDirection: "row", gap: 20 }}>
                {!isDemo && <NotificationBadge />}
                <Link href="/settings" asChild>
                  <TouchableOpacity activeOpacity={0.6}>
                    <MaterialIcons name="tune" size={24} color={colors.text} />
                  </TouchableOpacity>
                </Link>
              </View>
            </SafeAreaView>
          ),
          headerTitle: "Home",
        }}
      />
      <View
        style={{
          padding: 16,
          gap: 32,
          flex: 1,
          flexDirection: "column",
        }}
      >
        {isUpdateAvailable && (
          <Banner
            title="New Update Available"
            description="Update to the latest version to get the latest features and bug fixes"
            button={{
              onPress: onFetchUpdateAsync,
              children: "Update",
              loading: isDownloading || isRestarting,
            }}
          />
        )}
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <MotiView {...tileAnimationProps(0)}>
              <OrganizationTile />
            </MotiView>
            <MotiView {...tileAnimationProps(100)}>
              <RevenueTile />
            </MotiView>
          </View>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <MotiView {...tileAnimationProps(200)}>
              <CatalogueTile />
            </MotiView>
            <MotiView {...tileAnimationProps(300)}>
              <FinanceTile />
            </MotiView>
          </View>
        </View>

        <View style={{ gap: 24, flexDirection: "column", flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <ThemedText style={{ fontSize: 20 }}>
              Recent Subscriptions
            </ThemedText>
            <Link href="/subscriptions" asChild>
              <MiniButton secondary>View All</MiniButton>
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

        <View style={{ gap: 24, flexDirection: "column", flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <ThemedText style={{ fontSize: 20 }}>Recent Orders</ThemedText>
            <Link href="/orders" asChild>
              <MiniButton secondary>View All</MiniButton>
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
          flexDirection: "column",
          flex: 1,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
          }}
        >
          <ThemedText style={{ fontSize: 20 }}>Recent Customers</ThemedText>
          <Link href="/customers" asChild>
            <MiniButton secondary>View All</MiniButton>
          </Link>
        </View>

        {flatCustomers && flatCustomers.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: "row", gap: 16 }}
            contentInset={{ left: 16, right: 16 }}
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
  );
}
