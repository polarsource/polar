import { useProduct } from "@/hooks/polar/products";
import { useTheme } from "@/hooks/theme";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Order } from "@polar-sh/sdk/models/components/order.js";
import { Link } from "expo-router";
import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  StyleProp,
  TextStyle,
  TouchableOpacity,
} from "react-native";
import { ThemedText } from "../Shared/ThemedText";

export interface OrderRowProps {
  order: Order;
  showTimestamp?: boolean;
  style?: StyleProp<TextStyle>;
}

export const OrderRow = ({ order, style, showTimestamp }: OrderRowProps) => {
  const { colors } = useTheme();
  const { organization } = useContext(OrganizationContext);
  const { data: product } = useProduct(organization?.id, order.product.id);

  return (
    <Link
      href={`/orders/${order.id}`}
      style={[styles.container, { backgroundColor: colors.card }, style]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>
        <View style={[styles.imageContainer]}>
          {product?.medias?.[0]?.publicUrl ? (
            <Image
              source={{ uri: product?.medias?.[0]?.publicUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.imageFallback,
                {
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                },
              ]}
            >
              <MaterialIcons name="texture" size={24} color={colors.subtext} />
            </View>
          )}
        </View>
        <View style={styles.contentContainer}>
          <ThemedText style={styles.productName}>
            {order.product.name}
          </ThemedText>
          <View style={styles.metadataContainer}>
            {showTimestamp && (
              <>
                <ThemedText style={[styles.amount]} secondary>
                  {order.createdAt.toLocaleDateString("en-US", {
                    dateStyle: "medium",
                  })}
                </ThemedText>
                <ThemedText secondary>•</ThemedText>
              </>
            )}
            <ThemedText
              numberOfLines={1}
              style={[styles.email, { flexWrap: "wrap" }]}
              secondary
            >
              {order.customer.email}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    gap: 12,
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "500",
  },
  amount: {
    fontSize: 16,
  },
  email: {
    fontSize: 16,
    flexShrink: 1,
  },
  metadataContainer: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
});
