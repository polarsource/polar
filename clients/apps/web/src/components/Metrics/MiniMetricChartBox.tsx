import { Metric } from "@polar-sh/api";
import {
	Card,
	CardContent,
	CardHeader,
} from "@polar-sh/ui/components/atoms/Card";
import { formatCurrencyAndAmount } from "@polar-sh/ui/lib/money";

export interface MiniMetricBoxProps {
	title?: string;
	metric?: Metric;
	value?: number;
}

export const MiniMetricChartBox = ({
	title,
	metric,
	value,
}: MiniMetricBoxProps) => {
	return (
		<Card className="rounded-2xl">
			<CardHeader className="pb-2">
				<span className="text-gray-500 dark:text-polar-500">
					{title ?? metric?.display_name}
				</span>
			</CardHeader>
			<CardContent>
				<h3 className="text-2xl">
					{metric &&
						(metric.type === "scalar"
							? Intl.NumberFormat("en-US", {
									notation: "compact",
								}).format(value ?? 0)
							: formatCurrencyAndAmount(value ?? 0, "USD", 0))}
				</h3>
			</CardContent>
		</Card>
	);
};
