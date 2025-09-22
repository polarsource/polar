"use client";

import { createClientSideAPI } from "@/utils/client";
import { schemas } from "@polar-sh/client";
import { CurrentPeriodOverview } from "./CurrentPeriodOverview";
import { CustomerPortalGrants } from "./CustomerPortalGrants";
import {
	ActiveSubscriptionsOverview,
	InactiveSubscriptionsOverview,
} from "./CustomerPortalSubscriptions";
import { EmptyState } from "./EmptyState";
import AllInclusiveOutlined from "@mui/icons-material/AllInclusiveOutlined";
import DiamondOutlined from "@mui/icons-material/DiamondOutlined";
export interface CustomerPortalProps {
	organization: schemas["Organization"];
	products: schemas["CustomerProduct"][];
	subscriptions: schemas["CustomerSubscription"][];
	benefitGrants: schemas["CustomerBenefitGrant"][];
	customerSessionToken: string;
}

export const CustomerPortalOverview = ({
	organization,
	products,
	subscriptions,
	benefitGrants,
	customerSessionToken,
}: CustomerPortalProps) => {
	const api = createClientSideAPI(customerSessionToken);

	const activeSubscriptions = subscriptions.filter(
		(s) => s.status === "active",
	);
	const inactiveSubscriptions = subscriptions.filter(
		(s) => s.status !== "active",
	);

	return (
		<div className="flex flex-col gap-y-12">
			{activeSubscriptions.length > 0 ? (
				<>
					<div className="flex flex-col gap-y-4">
						{activeSubscriptions.map((s) => (
							<CurrentPeriodOverview key={s.id} subscription={s} api={api} />
						))}
					</div>
					<ActiveSubscriptionsOverview
						api={api}
						organization={organization}
						products={products}
						subscriptions={activeSubscriptions}
						customerSessionToken={customerSessionToken}
					/>
				</>
			) : (
				<EmptyState
					icon={<AllInclusiveOutlined />}
					title="No Active Subscriptions"
					description="You don't have any active subscriptions at the moment."
				/>
			)}

			{benefitGrants.length > 0 ? (
				<CustomerPortalGrants
					organization={organization}
					benefitGrants={benefitGrants}
					api={api}
				/>
			) : (
				<EmptyState
					icon={<DiamondOutlined />}
					title="No Benefits Available"
					description="You don't have any benefit grants available right now."
				/>
			)}

			{inactiveSubscriptions.length > 0 && (
				<InactiveSubscriptionsOverview
					organization={organization}
					subscriptions={inactiveSubscriptions}
					api={api}
					customerSessionToken={customerSessionToken}
					products={products}
				/>
			)}
		</div>
	);
};
