import { useOrder, useOrders } from "@/hooks/polar/orders";
import { useProduct } from "@/hooks/polar/products";
import { formatCurrencyAndAmount } from "@/utils/money";
import { useTheme } from "@/hooks/theme";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { CustomerRow } from "@/components/Customers/CustomerRow";
import * as Clipboard from "expo-clipboard";
import { DetailRow } from "@/components/Shared/Details";
import { Details } from "@/components/Shared/Details";
import { useSubscription } from "@/hooks/polar/subscriptions";
import { OrderRow } from "@/components/Orders/OrderRow";
import { useContext, useMemo } from "react";
import React from "react";
import { EmptyState } from "@/components/Shared/EmptyState";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { Button } from "@/components/Shared/Button";
import { ProductRow } from "@/components/Products/ProductRow";
import { ThemedText } from "@/components/Shared/ThemedText";
import { Pill } from "@/components/Shared/Pill";

const statusColors = {
  active: "green",
  canceled: "red",
  incomplete: "yellow",
  incomplete_expired: "red",
  past_due: "red",
  trialing: "blue",
  unpaid: "yellow",
} as const;

export default function Index() {
  const { organization } = useContext(OrganizationContext);
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();

  const {
    data: subscription,
    refetch,
    isRefetching,
  } = useSubscription(id as string);

  const { data: subscriptionOrders } = useOrders(organization?.id, {
    customerId: subscription?.customer.id,
    productId: subscription?.product.id,
  });

  const flatSubscriptionOrders = useMemo(() => {
    return subscriptionOrders?.pages.flatMap((page) => page.result.items) ?? [];
  }, [subscriptionOrders]);

  if (!subscription) {
    return (
      <Stack.Screen
        options={{
          title: "Subscription",
        }}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexDirection: "column", gap: 16 }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
      contentInset={{ bottom: 48 }}
    >
      <Stack.Screen
        options={{
          title: "Subscription",
        }}
      />

      <View style={[styles.section, { gap: 12, flexDirection: "row" }]}>
        <TouchableOpacity
          style={[
            styles.box,
            { backgroundColor: colors.card, flex: 1, gap: 4, width: "50%" },
          ]}
          onPress={() => {
            Clipboard.setStringAsync(subscription.id);
          }}
          activeOpacity={0.6}
        >
          <ThemedText style={[styles.label, { fontSize: 16 }]} secondary>
            #
          </ThemedText>
          <ThemedText
            style={[styles.value, { textTransform: "uppercase", fontSize: 16 }]}
            numberOfLines={1}
          >
            {subscription.id.split("-").pop()?.slice(-6, -1)}
          </ThemedText>
        </TouchableOpacity>
        <View
          style={[
            styles.box,
            { backgroundColor: colors.card, flex: 1, gap: 4, width: "50%" },
          ]}
        >
          <ThemedText style={[styles.label, { fontSize: 16 }]} secondary>
            Date
          </ThemedText>
          <ThemedText style={[styles.value, { fontSize: 16 }]}>
            {subscription.createdAt.toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          </ThemedText>
        </View>
      </View>

      <CustomerRow customer={subscription.customer} />

      <ProductRow product={subscription.product} />

      <View style={styles.section}>
        <Details>
          <DetailRow
            label="Status"
            value={
              <Pill
                color={statusColors[subscription.status]}
                textStyle={{ fontSize: 14 }}
              >
                {subscription.status.split("_").join(" ")}
              </Pill>
            }
            valueStyle={{ textTransform: "capitalize" }}
          />
          {subscription.status === "canceled" && (
            <DetailRow
              label="Cancellation Reason"
              value={subscription.customerCancellationReason}
            />
          )}
          {subscription.status === "canceled" && (
            <DetailRow
              label="Cancels At"
              value={
                subscription.cancelAtPeriodEnd
                  ? subscription.currentPeriodEnd?.toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })
                  : subscription.canceledAt?.toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })
              }
            />
          )}
          <DetailRow
            label="Recurring Interval"
            value={subscription.recurringInterval.split("_").join(" ")}
            valueStyle={{ textTransform: "capitalize" }}
          />
          <DetailRow
            label="Start Date"
            value={subscription.startedAt?.toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          />
          <DetailRow
            label="Renewal Date"
            value={subscription.currentPeriodEnd?.toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          />
          {subscription.endsAt && (
            <DetailRow
              label="End Date"
              value={subscription.endsAt?.toLocaleDateString("en-US", {
                dateStyle: "medium",
              })}
            />
          )}
        </Details>
      </View>

      {subscription.metadata &&
        Object.keys(subscription.metadata).length > 0 && (
          <View style={styles.section}>
            <Details>
              {Object.entries(subscription.metadata).map(([key, value]) => (
                <DetailRow key={key} label={key} value={String(value)} />
              ))}
            </Details>
          </View>
        )}

      {subscription.status === "active" && (
        <View style={{ flexDirection: "column", gap: 8 }}>
          <Link key={"update"} href={`/subscriptions/${id}/update`} asChild>
            <Button>Update Subscription</Button>
          </Link>
          <Link key={"cancel"} href={`/subscriptions/${id}/cancel`} asChild>
            <Button variant="secondary">Cancel Subscription</Button>
          </Link>
        </View>
      )}

      <View style={[styles.section, { gap: 16, paddingVertical: 12 }]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <ThemedText style={[styles.label, { fontSize: 20 }]}>
            Subscription Orders
          </ThemedText>
          <ThemedText style={[styles.label, { fontSize: 20 }]} secondary>
            {flatSubscriptionOrders.length}
          </ThemedText>
        </View>

        {flatSubscriptionOrders.length > 0 ? (
          <>
            {flatSubscriptionOrders.map((order) => (
              <OrderRow key={order.id} order={order} showTimestamp />
            ))}
          </>
        ) : (
          <EmptyState
            title="No Subscription Orders"
            description="This Subscription has no associated orders"
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    flexDirection: "column",
  },
  section: {},
  box: {
    flexDirection: "column",
    gap: 4,
    borderRadius: 12,
    padding: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
    fontWeight: "500",
  },
});
