import { View, Text, StyleSheet } from "react-native";
import { Tile } from "./Tile";
import { useMetrics } from "@/hooks/polar/metrics";
import { TimeInterval } from "@polar-sh/sdk/models/components/timeinterval.js";
import { useContext, useMemo, useState } from "react";
import { formatCurrencyAndAmount } from "@/utils/money";
import { useTheme } from "@/hooks/theme";
import { Path } from "react-native-svg";
import Svg from "react-native-svg";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { subMonths } from "date-fns";
import { ThemedText } from "../Shared/ThemedText";
import { useRevenueTrend } from "@/hooks/trend";

export const RevenueTile = () => {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const { organization } = useContext(OrganizationContext);
  const { colors } = useTheme();

  const metricParameters = useMemo(
    () => ({
      currentInterval: [subMonths(new Date(), 1), new Date()] as [Date, Date],
      previousInterval: [
        subMonths(new Date(), 2),
        subMonths(new Date(), 1),
      ] as [Date, Date],
      interval: TimeInterval.Day,
    }),
    []
  );

  const metrics = useMetrics(
    organization?.id,
    metricParameters.currentInterval[0],
    metricParameters.currentInterval[1],
    {
      interval: metricParameters.interval,
    }
  );

  const revenueTrend = useRevenueTrend(
    metricParameters.currentInterval,
    metricParameters.previousInterval,
    {
      interval: metricParameters.interval,
    }
  );

  const cumulativeRevenue = revenueTrend.currentCumulativeRevenue;

  const cumulativeRevenueData = useMemo(() => {
    return (
      metrics.data?.periods.reduce<{ value: number; date: Date }[]>(
        (acc, period) => [
          ...acc,
          {
            value: (acc[acc.length - 1]?.value ?? 0) + (period.revenue ?? 0),
            date: period.timestamp,
          },
        ],
        []
      ) ?? []
    );
  }, [metrics]);

  return (
    <Tile href="/metrics">
      <View style={styles.container}>
        <View style={{ flexDirection: "column", gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 4,
            }}
          >
            <ThemedText style={[styles.subtitle]} secondary>
              Revenue
            </ThemedText>
          </View>
          <ThemedText style={[styles.title]}>30 Days</ThemedText>
        </View>
        {cumulativeRevenueData && (
          <View
            style={{ height: 40, width: "100%" }}
            onLayout={(event) => {
              setHeight(event.nativeEvent.layout.height);
              setWidth(event.nativeEvent.layout.width);
            }}
          >
            <Svg height={height} width={width} preserveAspectRatio="none">
              <Path
                d={cumulativeRevenueData
                  .map((period, index) => {
                    const x =
                      index === 0
                        ? 1 // Start 1px in to avoid clipping
                        : (index / (cumulativeRevenueData.length - 1)) *
                          (width - 2); // Subtract 2 to avoid clipping

                    const values = cumulativeRevenueData.map((d) => d.value);
                    const maxValue = Math.max(...values);
                    const minValue = Math.min(...values);
                    const valueRange = Math.abs(maxValue - minValue) || 1; // Prevent division by zero

                    // Scale y value between top and bottom padding
                    const y =
                      height -
                      2 - // Bottom padding
                      ((period.value - minValue) / valueRange) * (height - 4); // Scale to available height

                    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")}
                stroke={colors.primary}
                strokeWidth="2"
                fill="none"
              />
            </Svg>
          </View>
        )}
        <ThemedText style={[styles.revenueValue]}>
          {formatCurrencyAndAmount(cumulativeRevenue, "usd", 0, "compact")}
        </ThemedText>
      </View>
    </Tile>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
  },
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
