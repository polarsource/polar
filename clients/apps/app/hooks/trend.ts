import { MetricsGetRequest } from "@polar-sh/sdk/models/operations/metricsget.js";
import { useMetrics } from "./polar/metrics";
import { useContext, useMemo } from "react";
import { OrganizationContext } from "@/providers/OrganizationProvider";

export const useRevenueTrend = (
  currentInterval: [Date, Date],
  previousInterval: [Date, Date],
  parameters: Omit<MetricsGetRequest, "startDate" | "endDate">
) => {
  const { organization } = useContext(OrganizationContext);

  const currentIntervalMetrics = useMetrics(
    organization?.id,
    currentInterval[0],
    currentInterval[1],
    parameters
  );

  const previousIntervalMetrics = useMetrics(
    organization?.id,
    previousInterval[0],
    previousInterval[1],
    parameters
  );

  const currentIntervalData = currentIntervalMetrics.data?.periods;
  const previousIntervalData = previousIntervalMetrics.data?.periods;

  const currentIntervalCumulativeRevenue = currentIntervalData?.reduce(
    (acc, period) => acc + period.revenue,
    0
  );
  const previousIntervalCumulativeRevenue = previousIntervalData?.reduce(
    (acc, period) => acc + period.revenue,
    0
  );

  const trend = useMemo(() => {
    if (
      !currentIntervalCumulativeRevenue ||
      !previousIntervalCumulativeRevenue
    ) {
      return 0;
    }

    const percentageChange =
      (currentIntervalCumulativeRevenue - previousIntervalCumulativeRevenue) /
      previousIntervalCumulativeRevenue;

    return percentageChange;
  }, [currentIntervalMetrics, previousIntervalMetrics]);

  return {
    trend,
    currentCumulativeRevenue: currentIntervalCumulativeRevenue ?? 0,
    previousCumulativeRevenue: previousIntervalCumulativeRevenue ?? 0,
  };
};
