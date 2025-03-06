import { getValueFormatter } from "@/utils/metrics";
import * as Plot from "@observablehq/plot";
import { schemas } from "@polar-sh/client";
import * as d3 from "d3";
import { GeistMono } from "geist/font/mono";
import { useCallback, useEffect, useMemo, useState } from "react";

const getTicks = (timestamps: Date[], maxTicks: number = 10): Date[] => {
	const step = Math.ceil(timestamps.length / maxTicks);
	return timestamps.filter((_, index) => index % step === 0);
};

const getTickFormat = (
	interval: schemas["TimeInterval"],
	ticks: Date[],
): ((t: Date, i: number) => any) | string => {
	switch (interval) {
		case "hour":
			return (t: Date, i: number) => {
				const previousDate = ticks[i - 1];
				if (!previousDate || previousDate.getDate() < t.getDate()) {
					return d3.timeFormat("%a %H:%M")(t);
				}
				return d3.timeFormat("%H:%M")(t);
			};
		case "day":
			return "%b %d";
		case "week":
			return "%b %d";
		case "month":
			return "%b %y";
		case "year":
			return "%Y";
	}
};
interface ChartProps {
	data: {
		value: number;
		timestamp: Date;
	}[];
	interval: schemas["TimeInterval"];
	metric: schemas["Metric"];
	height?: number;
	maxTicks?: number;
	onDataIndexHover?: (index: number | undefined) => void;
}

export const Chart: React.FC<ChartProps> = ({
	data,
	interval,
	metric,
	height: _height,
	maxTicks: _maxTicks,
	onDataIndexHover,
}) => {
	const [width, setWidth] = useState(0);
	const height = useMemo(() => _height || 300, [_height]);
	const maxTicks = useMemo(() => _maxTicks || 10, [_maxTicks]);

	const timestamps = useMemo(
		() => data.map(({ timestamp }) => timestamp),
		[data],
	);
	const ticks = useMemo(
		() => getTicks(timestamps, maxTicks),
		[timestamps, maxTicks],
	);
	const valueFormatter = useMemo(() => getValueFormatter(metric), [metric]);

	const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		const resizeObserver = new ResizeObserver((_entries) => {
			if (containerRef) {
				setWidth(containerRef.clientWidth ?? 0);
			}
		});

		if (containerRef) {
			resizeObserver.observe(containerRef);
		}

		return () => {
			if (containerRef) {
				resizeObserver.unobserve(containerRef);
			}
		};
	}, [containerRef]);

	const onMouseLeave = useCallback(() => {
		if (onDataIndexHover) {
			onDataIndexHover(undefined);
		}
	}, [onDataIndexHover]);

	useEffect(() => {
		if (!containerRef) {
			return;
		}

		const plot = Plot.plot({
			style: {
				background: "none",
			},
			height,
			width,
			marks: [
				Plot.axisX({
					tickFormat: getTickFormat(interval, ticks),
					ticks,
					label: null,
					stroke: "none",
					fontFamily: GeistMono.style.fontFamily,
				}),
				Plot.axisY({
					label: metric.display_name,
					stroke: "none",
					fontFamily: GeistMono.style.fontFamily,
				}),
				Plot.lineY(data, {
					x: "timestamp",
					y: metric.slug,
					stroke: "currentColor",
					strokeWidth: 1,
					marker: "circle-fill",
				}),
				Plot.ruleX(data, {
					x: "timestamp",
					stroke: "currentColor",
					strokeWidth: 1,
					strokeOpacity: 0.1,
				}),
			],
		});
		containerRef.append(plot);

		return () => plot.remove();
	}, [
		data,
		metric,
		containerRef,
		interval,
		ticks,
		valueFormatter,
		width,
		height,
		onDataIndexHover,
	]);

	return (
		<div
			className="text-polar-500 border-polar-700 w-full border p-4"
			ref={setContainerRef}
			onMouseLeave={onMouseLeave}
		/>
	);
};
