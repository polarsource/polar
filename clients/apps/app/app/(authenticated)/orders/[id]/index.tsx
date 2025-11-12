import { useOrder } from "@/hooks/polar/orders";
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
import { Stack, useLocalSearchParams } from "expo-router";
import { CustomerRow } from "@/components/Customers/CustomerRow";
import * as Clipboard from "expo-clipboard";
import { DetailRow } from "@/components/Shared/Details";
import { Details } from "@/components/Shared/Details";
import { ThemedText } from "@/components/Shared/ThemedText";
import { Pill } from "@/components/Shared/Pill";

const statusColors = {
  pending: "yellow",
  paid: "green",
  refunded: "blue",
  partially_refunded: "blue",
} as const;

export default function Index() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();

  const { data: order, refetch, isRefetching } = useOrder(id as string);

  if (!order) {
    return (
      <Stack.Screen
        options={{
          title: "Order",
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
          title: "Order",
        }}
      />

      <View style={[styles.section, { gap: 12, flexDirection: "row" }]}>
        <TouchableOpacity
          style={[
            styles.box,
            { backgroundColor: colors.card, flex: 1, gap: 4, width: "50%" },
          ]}
          onPress={() => {
            Clipboard.setStringAsync(order.id);
          }}
          activeOpacity={0.6}
        >
          <ThemedText style={[styles.label, { fontSize: 18 }]} secondary>
            #
          </ThemedText>
          <ThemedText
            style={[styles.value, { textTransform: "uppercase", fontSize: 18 }]}
            numberOfLines={1}
          >
            {order.id.split("-").pop()?.slice(-6, -1)}
          </ThemedText>
        </TouchableOpacity>
        <View
          style={[
            styles.box,
            { backgroundColor: colors.card, flex: 1, gap: 4, width: "50%" },
          ]}
        >
          <ThemedText style={[styles.label]} secondary>
            Date
          </ThemedText>
          <ThemedText style={[styles.value]}>
            {order.createdAt.toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          </ThemedText>
        </View>
      </View>

      <CustomerRow customer={order.customer} />

      <View style={styles.section}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, gap: 0, paddingVertical: 0 },
          ]}
        >
          {order.items.map((item, index, arr) => (
            <View
              key={item.id}
              style={{
                borderBottomWidth: index === arr.length - 1 ? 0 : 1,
                borderColor: colors.border,
                gap: 4,
                paddingVertical: 16,
              }}
            >
              <ThemedText style={[styles.label]} numberOfLines={1}>
                {item.label}
              </ThemedText>
              <ThemedText style={[styles.value]}>
                {formatCurrencyAndAmount(item.amount)}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Details style={{ backgroundColor: colors.card }}>
          <DetailRow
            label="Status"
            value={
              <Pill
                color={statusColors[order.status]}
                textStyle={{ fontSize: 14 }}
              >
                {order.status.split("_").join(" ")}
              </Pill>
            }
            valueStyle={{ textTransform: "capitalize" }}
          />
          <DetailRow
            label="Billing Reason"
            value={order.billingReason.split("_").join(" ")}
            valueStyle={{ textTransform: "capitalize" }}
          />
          <DetailRow
            label="Subtotal"
            value={formatCurrencyAndAmount(order.subtotalAmount)}
          />
          <DetailRow
            label="Discount"
            value={`-${formatCurrencyAndAmount(order.discountAmount)}`}
          />
          <DetailRow
            label="Net"
            value={formatCurrencyAndAmount(order.netAmount)}
          />
          <DetailRow
            label="Tax"
            value={formatCurrencyAndAmount(order.taxAmount)}
          />
          <DetailRow
            labelStyle={{ color: colors.text }}
            label="Total"
            value={formatCurrencyAndAmount(order.totalAmount)}
          />
        </Details>
      </View>

      <Details style={{ backgroundColor: colors.card }}>
        <DetailRow
          label="Address"
          value={order.customer.billingAddress?.line1}
        />
        <DetailRow
          label="Address 2"
          value={order.customer.billingAddress?.line2}
        />
        <DetailRow label="City" value={order.customer.billingAddress?.city} />
        <DetailRow label="State" value={order.customer.billingAddress?.state} />
        <DetailRow
          label="Postal Code"
          value={order.customer.billingAddress?.postalCode}
        />
        <DetailRow
          label="Country"
          value={order.customer.billingAddress?.country}
        />
      </Details>

      {order.metadata && Object.keys(order.metadata).length > 0 && (
        <View style={styles.section}>
          <Details>
            {Object.entries(order.metadata).map(([key, value]) => (
              <DetailRow key={key} label={key} value={String(value)} />
            ))}
          </Details>
        </View>
      )}
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
  image: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  imageFallback: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackText: {
    fontSize: 16,
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
});
