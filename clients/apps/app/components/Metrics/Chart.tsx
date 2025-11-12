import { View, StyleSheet } from "react-native";
import { useState, useMemo } from "react";
import { Path } from "react-native-svg";
import Svg from "react-native-svg";
import { useTheme } from "@/hooks/theme";
import { ThemedText } from "@/components/Shared/ThemedText";
import { Metric } from "@polar-sh/sdk/models/components/metric.js";
import { getFormattedMetricValue } from "./utils";
import { toValueDataPoints, useMetrics } from "@/hooks/polar/metrics";
import { MetricsTotals } from "@polar-sh/sdk/models/components/metricstotals.js";
import { ChartPath } from "./ChartPath";
import { format } from "date-fns";

interface ChartProps {
  currentPeriodData: ReturnType<typeof useMetrics>["data"];
  previousPeriodData: ReturnType<typeof useMetrics>["data"];
  title?: string;
  trend?: number;
  height?: number;
  showTotal?: boolean;
  strokeWidth?: number;
  showPreviousPeriodTotal?: boolean;
  metric: Metric & {
    key: keyof MetricsTotals;
  };
  currentPeriod: {
    startDate: Date;
    endDate: Date;
  };
}

export const Chart = ({
  currentPeriodData,
  previousPeriodData,
  title,
  height = 80,
  strokeWidth = 2,
  showPreviousPeriodTotal = true,
  metric,
  currentPeriod,
}: ChartProps) => {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [chartHeight, setChartHeight] = useState(0);

  const totalValue = useMemo(() => {
    return currentPeriodData?.totals[metric.key] ?? 0;
  }, [currentPeriodData]);

  const formattedTotal = useMemo(() => {
    return getFormattedMetricValue(metric, totalValue);
  }, [totalValue, metric]);

  const previousPeriodTotalValue = useMemo(() => {
    return previousPeriodData?.totals[metric.key];
  }, [previousPeriodData]);

  const previousPeriodFormattedTotal = useMemo(() => {
    return previousPeriodTotalValue !== undefined
      ? getFormattedMetricValue(metric, previousPeriodTotalValue)
      : null;
  }, [previousPeriodTotalValue, metric]);

  const currentPeriodDataPoints = toValueDataPoints(
    currentPeriodData,
    metric.key
  );
  const previousPeriodDataPoints = toValueDataPoints(
    previousPeriodData,
    metric.key
  );

  const values = [
    ...currentPeriodDataPoints.map((d) => d.value),
    ...previousPeriodDataPoints.map((d) => d.value),
  ];

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        {title && <ThemedText style={styles.title}>{title}</ThemedText>}
      </View>

      <View style={styles.totalValueContainer}>
        <ThemedText style={styles.totalValue}>{formattedTotal}</ThemedText>
        {showPreviousPeriodTotal &&
        typeof previousPeriodFormattedTotal !== "undefined" ? (
          <ThemedText style={styles.previousPeriodTotalValue} secondary>
            {`vs. ${previousPeriodFormattedTotal}`}
          </ThemedText>
        ) : null}
      </View>

      <View
        style={[styles.chartView, { height }]}
        onLayout={(event) => {
          setChartHeight(event.nativeEvent.layout.height);
          setWidth(event.nativeEvent.layout.width);
        }}
      >
        <Svg height={chartHeight} width={width} preserveAspectRatio="none">
          <ChartPath
            dataPoints={previousPeriodDataPoints}
            width={width}
            chartHeight={chartHeight}
            strokeWidth={strokeWidth}
            strokeColor={colors.secondary}
            minValue={minValue}
            maxValue={maxValue}
          />
          <ChartPath
            dataPoints={currentPeriodDataPoints}
            width={width}
            chartHeight={chartHeight}
            strokeWidth={strokeWidth}
            strokeColor={colors.primary}
            minValue={minValue}
            maxValue={maxValue}
          />
        </Svg>
      </View>
      <View style={styles.chartTimeline}>
        <ThemedText style={styles.chartTimelineText} secondary>
          {format(currentPeriod.startDate, "MMM d")}
        </ThemedText>
        <ThemedText
          style={[styles.chartTimelineText, { textAlign: "right" }]}
          secondary
        >
          {format(currentPeriod.endDate, "MMM d")}
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 24,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 18,
  },
  totalValue: {
    fontSize: 36,
  },
  totalValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  previousPeriodTotalValue: {
    fontSize: 16,
  },
  chartView: {
    width: "100%",
  },
  chartTimeline: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartTimelineText: {
    fontSize: 12,
  },
});
