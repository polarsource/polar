"use client";

import DateRangePicker from "@/components/Metrics/DateRangePicker";
import IntervalPicker, {
  getNextValidInterval,
} from "@/components/Metrics/IntervalPicker";
import ProductSelect from "@/components/Products/ProductSelect";
import { schemas } from "@polar-sh/client";
import { useCallback, useMemo } from "react";
import { useMetricsFilters } from "./useMetricsFilters";

interface MetricsHeaderProps {
  organization: schemas["Organization"];
  earliestDateISOString: string;
}

export function MetricsHeader({
  organization,
  earliestDateISOString,
}: MetricsHeaderProps) {
  const {
    interval,
    setInterval,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    productId,
    setProductId,
    minDate,
  } = useMetricsFilters(earliestDateISOString);

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  );

  const onIntervalChange = useCallback(
    (newInterval: schemas["TimeInterval"]) => {
      setInterval(newInterval);
    },
    [setInterval],
  );

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const validInterval = getNextValidInterval(
        interval,
        dateRange.from,
        dateRange.to,
      );
      setStartDate(dateRange.from);
      setEndDate(dateRange.to);
      setInterval(validInterval);
    },
    [interval, setStartDate, setEndDate, setInterval],
  );

  const onProductSelect = useCallback(
    (value: string[]) => {
      setProductId(value.length > 0 ? value : null);
    },
    [setProductId],
  );

  return (
    <div className="flex flex-col items-center gap-2 lg:flex-row">
      <div className="w-full lg:w-auto">
        <IntervalPicker
          interval={interval}
          onChange={onIntervalChange}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
      <div className="w-full lg:w-auto">
        <DateRangePicker
          date={dateRange}
          onDateChange={onDateChange}
          minDate={minDate}
          className="w-full"
        />
      </div>
      <div className="w-full lg:w-auto">
        <ProductSelect
          organization={organization}
          value={productId ?? []}
          onChange={onProductSelect}
          includeArchived={true}
          className="w-auto"
        />
      </div>
    </div>
  );
}
