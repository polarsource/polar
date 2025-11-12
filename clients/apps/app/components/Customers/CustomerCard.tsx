import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import React from "react";
import { Customer } from "@polar-sh/sdk/models/components/customer";
import { Avatar } from "../Shared/Avatar";
import { Link } from "expo-router";
import { useTheme } from "@/hooks/theme";
import { ThemedText } from "../Shared/ThemedText";

export interface CustomerCardProps {
  customer: Customer;
}

export const CustomerCard = ({ customer }: CustomerCardProps) => {
  const { colors } = useTheme();

  return (
    <Link
      href={`/customers/${customer.id}`}
      style={[styles.container, { backgroundColor: colors.card }]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>
        <Avatar
          size={64}
          name={customer.name ?? customer.email}
          image={customer.avatarUrl ?? undefined}
        />
        <View style={styles.content}>
          <ThemedText style={[styles.name]}>{customer.name ?? "—"}</ThemedText>
          <ThemedText
            style={[styles.email]}
            numberOfLines={1}
            ellipsizeMode="tail"
            secondary
          >
            {customer.email}
          </ThemedText>
        </View>
      </TouchableOpacity>
    </Link>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    flexDirection: "column",
    alignItems: "center",
    gap: 32,
    borderRadius: 16,
    width: Dimensions.get("screen").width * 0.66,
  },
  content: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  email: {
    fontSize: 14,
    textAlign: "center",
  },
});
