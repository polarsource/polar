"use client";

import { DashboardBody } from "@/components/Layout/DashboardLayout";
import OrganizationAccessTokensSettings from "@/components/Settings/OrganizationAccessTokensSettings";
import OrganizationProfileSettings from "@/components/Settings/OrganizationProfileSettings";
import OrganizationSubscriptionSettings from "@/components/Settings/OrganizationSubscriptionSettings";
import { Section, SectionDescription } from "@/components/Settings/Section";
import { MaintainerOrganizationContext } from "@/providers/maintainerOrganization";
import { useContext } from "react";

export default function ClientPage() {
	const { organization: org } = useContext(MaintainerOrganizationContext);

	return (
		<DashboardBody>
			<div className="flex flex-col gap-y-12">
				<Section id="organization">
					<SectionDescription
						title="Organization"
						description="Configure your organization settings"
					/>
					<OrganizationProfileSettings organization={org} />
				</Section>

				<Section id="subscriptions">
					<SectionDescription
						title="Subscriptions"
						description="Configure how subscriptions are managed"
					/>
					<OrganizationSubscriptionSettings organization={org} />
				</Section>

				<Section id="developers">
					<SectionDescription
						title="Developers"
						description="Manage access tokens to authenticate with the Polar API"
					/>
					<OrganizationAccessTokensSettings organization={org} />
				</Section>
			</div>
		</DashboardBody>
	);
}
