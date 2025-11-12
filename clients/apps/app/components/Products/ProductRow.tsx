import { useProduct } from "@/hooks/polar/products";
import { useTheme } from "@/hooks/theme";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Order } from "@polar-sh/sdk/models/components/order.js";
import { Product } from "@polar-sh/sdk/models/components/product.js";
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
import AmountLabel from "./AmountLabel";
import { ProductPriceLabel } from "./ProductPriceLabel";
import { ThemedText } from "../Shared/ThemedText";
import { Pill } from "../Shared/Pill";

export interface ProductRowProps {
  product: Product;
  style?: StyleProp<TextStyle>;
}

export const ProductRow = ({ product, style }: ProductRowProps) => {
  const { colors } = useTheme();
  const { organization } = useContext(OrganizationContext);

  return (
    <Link
      href={`/products/${product.id}`}
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
              gap: 4,
              justifyContent: "space-between",
            }}
          >
            <ThemedText
              style={styles.productName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {product.name}
            </ThemedText>
            {product.isArchived && <Pill color="red">Archived</Pill>}
          </View>
          <ProductPriceLabel product={product} />
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
  fallbackText: {
    fontSize: 20,
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "500",
    flexShrink: 1,
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
