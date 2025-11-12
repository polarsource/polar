import { useTheme } from "@/hooks/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { Link } from "expo-router";
import React from "react";
import {
  View,
  StyleSheet,
  Image,
  StyleProp,
  TextStyle,
  TouchableOpacity,
} from "react-native";
import { Pill } from "../Shared/Pill";
import { ThemedText } from "../Shared/ThemedText";
import { ProductPriceLabel } from "../Products/ProductPriceLabel";

export interface SubscriptionRowProps {
  subscription: Subscription;
  showCustomer?: boolean;
  style?: StyleProp<TextStyle>;
}

export const SubscriptionRow = ({
  subscription,
  style,
  showCustomer,
}: SubscriptionRowProps) => {
  const { colors } = useTheme();
  const product = subscription.product;

  return (
    <Link
      href={`/subscriptions/${subscription.id}`}
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
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <ThemedText
              style={styles.productName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subscription.product.name}
            </ThemedText>
            <Pill color={subscription.status === "active" ? "green" : "red"}>
              {subscription.status.split("_").join(" ")}
            </Pill>
          </View>
          <View style={styles.metadataContainer}>
            <ProductPriceLabel product={subscription.product} />
            {showCustomer && (
              <>
                <ThemedText style={styles.meta} secondary>
                  •
                </ThemedText>
                <ThemedText
                  numberOfLines={1}
                  style={[styles.meta, { flexWrap: "wrap" }]}
                  secondary
                >
                  {subscription.customer.email}
                </ThemedText>
              </>
            )}
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
  status: {
    fontSize: 16,
    textTransform: "capitalize",
  },
  metadataContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  meta: {
    fontSize: 16,
    flexShrink: 1,
  },
});
