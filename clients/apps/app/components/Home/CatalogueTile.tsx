import { View, StyleSheet } from "react-native";
import { Tile } from "./Tile";
import { useContext, useMemo } from "react";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { ThemedText } from "../Shared/ThemedText";
import { useProducts } from "@/hooks/polar/products";
import { endOfWeek, startOfWeek, subDays } from "date-fns";
import { useTheme } from "@/hooks/theme";
import { useMetrics } from "@/hooks/polar/metrics";

export const CatalogueTile = () => {
  const { colors } = useTheme();

  const { organization } = useContext(OrganizationContext);
  const { data: products } = useProducts(organization?.id, {
    limit: 100,
  });

  const startDate = useMemo(() => {
    return subDays(new Date(), 6);
  }, []);

  const endDate = useMemo(() => {
    return new Date();
  }, []);

  const metrics = useMetrics(organization?.id, startDate, endDate, {
    interval: "day",
  });

  return (
    <Tile href="/products">
      <View
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "column", gap: 4 }}>
          <ThemedText style={[styles.subtitle]} secondary>
            Catalogue
          </ThemedText>
          <ThemedText style={[styles.title]}>
            {products?.result?.items.length}{" "}
            {`${
              (products?.result?.items.length ?? 0) > 1 ? "Products" : "Product"
            }`}
          </ThemedText>
        </View>
        <View style={{ flexDirection: "column", gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 4,
            }}
          >
            <ThemedText style={[styles.subtitle]} secondary>
              Order Streak
            </ThemedText>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 4,
            }}
          >
            {metrics.data?.periods.map((period) => (
              <View
                key={period.timestamp.toISOString()}
                style={{
                  height: 10,
                  width: 10,
                  backgroundColor:
                    period.orders > 0 ? colors.primary : colors.border,
                  borderRadius: 10,
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Tile>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 16,
  },
  revenueValue: {
    fontSize: 26,
  },
});
