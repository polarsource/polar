import MetricChartBox from "@/components/Metrics/MetricChartBox";
import { ParsedMetricPeriod } from "@/hooks/queries";
import { Metrics } from "@polar-sh/api";

export interface ProductMetricsViewProps {
	metrics?: Metrics;
	periods?: ParsedMetricPeriod[];
	loading: boolean;
}

export const ProductMetricsView = ({
	metrics,
	loading,
	periods,
}: ProductMetricsViewProps) => {
	return (
		<div className="flex flex-col gap-y-12">
			<MetricChartBox
				data={periods ?? []}
				loading={loading}
				metric={metrics?.orders}
			/>
			<MetricChartBox
				data={periods ?? []}
				loading={loading}
				metric={metrics?.revenue}
			/>
		</div>
	);
};
