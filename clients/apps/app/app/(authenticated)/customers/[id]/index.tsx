import { Avatar } from "@/components/Shared/Avatar";
import { DetailRow } from "@/components/Shared/Details";
import { Details } from "@/components/Shared/Details";
import { EmptyState } from "@/components/Shared/EmptyState";
import { OrderRow } from "@/components/Orders/OrderRow";
import { SubscriptionRow } from "@/components/Subscriptions/SubscriptionRow";
import { useCustomer } from "@/hooks/polar/customers";
import { useMetrics } from "@/hooks/polar/metrics";
import { useOrders } from "@/hooks/polar/orders";
import { useSubscriptions } from "@/hooks/polar/subscriptions";
import { useTheme } from "@/hooks/theme";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { formatCurrencyAndAmount } from "@/utils/money";
import { TimeInterval } from "@polar-sh/sdk/models/components/timeinterval.js";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useContext, useMemo } from "react";
import { RefreshControl, ScrollView, View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/Shared/ThemedText";

export default function Index() {
  const { organization } = useContext(OrganizationContext);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams();

  const {
    data: customer,
    refetch: refetchCustomer,
    isRefetching: isCustomerRefetching,
  } = useCustomer(organization?.id, id as string);

  const startDate = useMemo(() => {
    return new Date(customer?.createdAt ?? new Date());
  }, [customer]);

  const endDate = useMemo(() => {
    return new Date();
  }, []);

  const {
    data: metrics,
    refetch: refetchMetrics,
    isRefetching: isMetricsRefetching,
  } = useMetrics(organization?.id, startDate, endDate, {
    interval: TimeInterval.Month,
    customerId: id as string,
  });

  const {
    data: orders,
    refetch: refetchOrders,
    isRefetching: isOrdersRefetching,
  } = useOrders(organization?.id, {
    customerId: id as string,
  });

  const flatOrders = useMemo(() => {
    return orders?.pages.flatMap((page) => page.result.items) ?? [];
  }, [orders]);

  const {
    data: subscriptions,
    refetch: refetchSubscriptions,
    isRefetching: isSubscriptionsRefetching,
  } = useSubscriptions(organization?.id, {
    customerId: id as string,
    active: null,
  });

  const flatSubscriptions = useMemo(() => {
    return subscriptions?.pages.flatMap((page) => page.result.items) ?? [];
  }, [subscriptions]);

  const isRefetching =
    isCustomerRefetching ||
    isSubscriptionsRefetching ||
    isOrdersRefetching ||
    isMetricsRefetching;

  const refetch = useCallback(() => {
    return Promise.allSettled([
      refetchCustomer(),
      refetchOrders(),
      refetchMetrics(),
      refetchSubscriptions(),
    ]);
  }, [refetchCustomer, refetchOrders, refetchMetrics, refetchSubscriptions]);

  return (
    <>
      <Stack.Screen
        options={{
          title: customer?.name ?? "Customer",
        }}
      />
      <ScrollView
        style={[styles.container]}
        refreshControl={
          <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
        }
        contentContainerStyle={{
          flexDirection: "column",
          gap: 24,
        }}
        contentInset={{ bottom: 48 }}
      >
        <View style={styles.hero}>
          <Avatar
            image={customer?.avatarUrl}
            name={customer?.name ?? customer?.email ?? ""}
            size={120}
          />
          <View style={styles.heroInfo}>
            <ThemedText style={styles.customerName}>
              {customer?.name ?? "—"}
            </ThemedText>
            <ThemedText style={styles.customerEmail} secondary>
              {customer?.email}
            </ThemedText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={{
              backgroundColor: colors.card,
              padding: 12,
              borderRadius: 12,
              flex: 1,
              gap: 8,
            }}
          >
            <ThemedText style={styles.label} secondary>
              Revenue
            </ThemedText>
            <ThemedText style={styles.value}>
              {formatCurrencyAndAmount(
                metrics?.periods[metrics?.periods.length - 1]
                  .cumulativeRevenue ?? 0
              )}
            </ThemedText>
          </View>
          <View
            style={{
              backgroundColor: colors.card,
              padding: 12,
              borderRadius: 12,
              flex: 1,
              gap: 8,
            }}
          >
            <ThemedText style={styles.label} secondary>
              First Seen
            </ThemedText>
            <ThemedText style={styles.value}>
              {new Date(customer?.createdAt ?? "").toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <Details>
            <DetailRow
              label="Address"
              value={customer?.billingAddress?.line1}
            />
            <DetailRow
              label="Address 2"
              value={customer?.billingAddress?.line2}
            />
            <DetailRow label="City" value={customer?.billingAddress?.city} />
            <DetailRow label="State" value={customer?.billingAddress?.state} />
            <DetailRow
              label="Postal Code"
              value={customer?.billingAddress?.postalCode}
            />
            <DetailRow
              label="Country"
              value={customer?.billingAddress?.country}
            />
          </Details>
        </View>

        {customer?.metadata && Object.keys(customer.metadata).length > 0 && (
          <View style={styles.section}>
            <Details>
              {Object.entries(customer.metadata).map(([key, value]) => (
                <DetailRow key={key} label={key} value={String(value)} />
              ))}
            </Details>
          </View>
        )}

        <View style={{ gap: 16, flexDirection: "column", flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <ThemedText style={{ fontSize: 24 }}>Subscriptions</ThemedText>
          </View>
          {flatSubscriptions.length > 0 ? (
            <View style={{ gap: 8 }}>
              {flatSubscriptions.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              title="No Subscriptions"
              description="No subscriptions found for this customer"
            />
          )}
        </View>

        <View style={{ gap: 16, flexDirection: "column", flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <ThemedText style={{ fontSize: 24 }}>Orders</ThemedText>
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
              description="No orders found for this customer"
            />
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    flexDirection: "column",
  },
  hero: {
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
  },
  heroInfo: {
    alignItems: "center",
    flexDirection: "column",
    gap: 6,
  },
  customerName: {
    fontSize: 24,
    fontWeight: "600",
  },
  customerEmail: {
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  image: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  imageFallback: {
    width: 120,
    height: 120,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  fallbackText: {
    fontSize: 36,
    fontWeight: "600",
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
  },
  section: {},
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
  customerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: "600",
  },
  customerInfo: {
    flexDirection: "column",
    gap: 4,
  },
});
