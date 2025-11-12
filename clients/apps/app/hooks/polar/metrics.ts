import { usePolarClient } from "@/providers/PolarClientProvider";
import { MetricPeriod } from "@polar-sh/sdk/models/components/metricperiod.js";
import { MetricsGetRequest } from "@polar-sh/sdk/models/operations/metricsget.js";
import { RFCDate } from "@polar-sh/sdk/types/rfcdate.js";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const useMetrics = (
  organizationId: string | undefined,
  startDate: Date,
  endDate: Date,
  parameters: Omit<MetricsGetRequest, "startDate" | "endDate">,
  enabled = true
) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: [
      "metrics",
      organizationId,
      { ...parameters, startDate, endDate },
    ],
    queryFn: async () => {
      const metrics = await polar.metrics.get({
        organizationId,
        ...(parameters || {}),
        startDate: new RFCDate(startDate),
        endDate: new RFCDate(endDate),
      });

      return {
        ...metrics,
        periods: metrics.periods.map((period) => ({
          ...period,
          timestamp: new Date(period.timestamp),
        })),
      };
    },
    enabled: !!organizationId && enabled,
  });
};

export const toValueDataPoints = (
  metrics: ReturnType<typeof useMetrics>["data"] | undefined,
  key: Exclude<keyof MetricPeriod, "timestamp">
) => {
  if (!metrics) return [];

  return metrics.periods.map((period) => ({
    value: period[key] ?? 0,
    date: period.timestamp,
  }));
};
