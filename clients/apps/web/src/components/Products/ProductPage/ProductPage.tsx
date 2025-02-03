import { Organization, Product } from "@polar-sh/api";
import { DashboardBody } from "../../Layout/DashboardLayout";
import { ProductPageContextView } from "./ProductPageContextView";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@polar-sh/ui/components/atoms/Tabs";
import { ProductOverview } from "./ProductOverview";
import { ProductMetricsView } from "./ProductMetricsView";
import { Status } from "@polar-sh/ui/components/atoms/Status";
import { ProductThumbnail } from "../ProductThumbnail";
import { useMetrics } from "@/hooks/queries";
import { dateToInterval } from "@/utils/metrics";

const ProductTypeDisplayColor: Record<string, string> = {
	subscription: "bg-emerald-100 text-emerald-500 dark:bg-emerald-950",
	one_time: "bg-blue-100 text-blue-400 dark:bg-blue-950",
};

export interface ProductPageProps {
	organization: Organization;
	product: Product;
}

export const ProductPage = ({ organization, product }: ProductPageProps) => {
	const { data: metrics, isLoading: metricsLoading } = useMetrics({
		organizationId: organization.id,
		productId: [product.id],
		interval: dateToInterval(new Date(product.created_at)),
		startDate: new Date(product.created_at),
		endDate: new Date(),
	});

	return (
		<Tabs defaultValue="overview" className="h-full">
			<DashboardBody
				title={
					<div className="flex flex-row items-center gap-6">
						<div className="flex flex-row items-center gap-4">
							<ProductThumbnail product={product} />
							<h1 className="text-2xl">{product.name}</h1>
						</div>
						<Status
							status={
								product.is_recurring ? "Subscription" : "One-time Product"
							}
							className={
								ProductTypeDisplayColor[
									product.is_recurring ? "subscription" : "one-time"
								]
							}
						/>
					</div>
				}
				header={
					<TabsList>
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="metrics">Metrics</TabsTrigger>
					</TabsList>
				}
				contextViewClassName="hidden md:block"
				contextView={
					<ProductPageContextView
						organization={organization}
						product={product}
					/>
				}
			>
				<TabsContent value="overview">
					<ProductOverview
						metrics={metrics?.metrics}
						periods={metrics?.periods}
						organization={organization}
						product={product}
					/>
				</TabsContent>
				<TabsContent value="metrics">
					<ProductMetricsView
						metrics={metrics?.metrics}
						periods={metrics?.periods}
						loading={metricsLoading}
					/>
				</TabsContent>
			</DashboardBody>
		</Tabs>
	);
};
