"use client";

import { DashboardBody } from "@/components/Layout/DashboardLayout";
import { ConfirmModal } from "@/components/Modal/ConfirmModal";
import { useModal } from "@/components/Modal/useModal";
import WebhookContextView from "@/components/Settings/Webhook/WebhookContextView";
import DeliveriesTable from "@/components/Settings/Webhook/WebhookDeliveriesTable";
import { toast } from "@/components/Toast/use-toast";
import { getStatusRedirect } from "@/components/Toast/utils";
import { useDeleteWebhookEndpoint, useWebhookEndpoint } from "@/hooks/queries";
import {
	DataTablePaginationState,
	DataTableSortingState,
} from "@/utils/datatable";
import { schemas } from "@polar-sh/client";
import Button from "@polar-sh/ui/components/atoms/Button";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";

export default function ClientPage({
	organization,
	pagination,
	sorting,
}: {
	organization: schemas["Organization"];
	pagination: DataTablePaginationState;
	sorting: DataTableSortingState;
}) {
	const { id }: { id: string } = useParams();

	const { data: endpoint } = useWebhookEndpoint(id);

	const {
		hide: hideDeleteModal,
		isShown: isArchiveModalShown,
		show: showArchiveModal,
	} = useModal();

	const router = useRouter();

	const deleteWebhookEndpoint = useDeleteWebhookEndpoint();

	const handleDeleteWebhookEndpoint = useCallback(async () => {
		if (!endpoint) return;

		const { error } = await deleteWebhookEndpoint.mutateAsync({
			id: endpoint.id,
		});

		if (error) {
			toast({
				title: "Webhook Endpoint Deletion Failed",
				description: `Error deleting Webhook Endpoint: ${error.detail}`,
			});
			return;
		}

		hideDeleteModal();

		router.push(
			getStatusRedirect(
				`/dashboard/${organization.slug}/settings/webhooks`,
				"Webhook Endpoint Deleted",
				"Webhook Endpoint was deleted successfully",
			),
		);
	}, [deleteWebhookEndpoint, hideDeleteModal, router, endpoint, organization]);

	if (!endpoint) {
		return null;
	}

	return (
		<DashboardBody
			title="Webhook"
			header={
				<Button variant="destructive" onClick={showArchiveModal}>
					Delete
				</Button>
			}
			contextView={
				<WebhookContextView organization={organization} endpoint={endpoint} />
			}
			className="gap-y-8"
			wide
		>
			<h3 className="text-lg">{endpoint.url}</h3>
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-2">
					<h2 className="text-xl font-medium">Deliveries</h2>
				</div>
				<DeliveriesTable
					endpoint={endpoint}
					pagination={pagination}
					sorting={sorting}
					organization={organization}
				/>
			</div>

			<ConfirmModal
				title="Delete Webhook Endpoint"
				description={
					"This action will delete the endpoint configuration and stop sending webhooks to it"
				}
				destructiveText="Delete"
				onConfirm={handleDeleteWebhookEndpoint}
				isShown={isArchiveModalShown}
				hide={hideDeleteModal}
				destructive
			/>
		</DashboardBody>
	);
}
