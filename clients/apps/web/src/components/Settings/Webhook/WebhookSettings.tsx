"use client";

import { useListWebhooksEndpoints } from "@/hooks/queries";
import { ArrowUpRightIcon } from "@heroicons/react/20/solid";
import { schemas } from "@polar-sh/client";
import Button from "@polar-sh/ui/components/atoms/Button";
import FormattedDateTime from "@polar-sh/ui/components/atoms/FormattedDateTime";
import ShadowListGroup from "@polar-sh/ui/components/atoms/ShadowListGroup";
import Link from "next/link";
import { InlineModal } from "../../Modal/InlineModal";
import { useModal } from "../../Modal/useModal";
import NewWebhookModal from "./NewWebhookModal";

const WebhookSettings = (props: { org: schemas["Organization"] }) => {
	const {
		isShown: isNewWebhookModalShown,
		show: showNewWebhookModal,
		hide: hideNewWebhookModal,
	} = useModal();

	const endpoints = useListWebhooksEndpoints({
		organizationId: props.org.id,
		limit: 100,
		page: 1,
	});

	return (
		<>
			<ShadowListGroup>
				{endpoints.data?.items && endpoints.data.items.length > 0 ? (
					endpoints.data?.items.map((e) => {
						return (
							<ShadowListGroup.Item key={e.id}>
								<Endpoint organization={props.org} endpoint={e} />
							</ShadowListGroup.Item>
						);
					})
				) : (
					<ShadowListGroup.Item>
						<p className="dark:text-polar-400 text-sm text-gray-500">
							{props.org.name} doesn&apos;t have any webhooks yet
						</p>
					</ShadowListGroup.Item>
				)}
				<ShadowListGroup.Item>
					<div className="flex flex-row items-center gap-x-4">
						<Button asChild onClick={showNewWebhookModal}>
							Add Endpoint
						</Button>
						<Link
							href="https://docs.polar.sh/integrate/webhooks/"
							className="shrink-0"
						>
							<Button className="gap-x-1" asChild variant="ghost">
								<span>Documentation</span>
								<ArrowUpRightIcon className="h-4 w-4" />
							</Button>
						</Link>
					</div>
				</ShadowListGroup.Item>
			</ShadowListGroup>
			<InlineModal
				isShown={isNewWebhookModalShown}
				hide={hideNewWebhookModal}
				modalContent={
					<NewWebhookModal
						hide={hideNewWebhookModal}
						organization={props.org}
					/>
				}
			/>
		</>
	);
};

export default WebhookSettings;

const Endpoint = ({
	organization,
	endpoint,
}: {
	organization: schemas["Organization"];
	endpoint: schemas["WebhookEndpoint"];
}) => {
	return (
		<div className="flex items-center justify-between overflow-hidden">
			<div className="flex w-2/3 flex-col gap-y-1">
				<p className="truncate font-mono text-sm">{endpoint.url}</p>
				<p className="dark:text-polar-400 text-sm text-gray-500">
					<FormattedDateTime datetime={endpoint.created_at} dateStyle="long" />
				</p>
			</div>
			<div className="dark:text-polar-400 text-gray-500">
				<Link
					href={`/dashboard/${organization.slug}/settings/webhooks/endpoints/${endpoint.id}`}
				>
					<Button asChild variant="secondary">
						Details
					</Button>
				</Link>
			</div>
		</div>
	);
};
