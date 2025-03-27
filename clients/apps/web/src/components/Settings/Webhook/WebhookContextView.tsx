"use client";

import { DashboardBody } from "@/components/Layout/DashboardLayout";
import { ConfirmModal } from "@/components/Modal/ConfirmModal";
import { useModal } from "@/components/Modal/useModal";
import {
	FieldEvents,
	FieldFormat,
	FieldSecret,
	FieldUrl,
} from "@/components/Settings/Webhook/WebhookForm";
import { toast } from "@/components/Toast/use-toast";
import { getStatusRedirect } from "@/components/Toast/utils";
import {
	useDeleteWebhookEndpoint,
	useEditWebhookEndpoint,
} from "@/hooks/queries";
import { schemas } from "@polar-sh/client";
import Button from "@polar-sh/ui/components/atoms/Button";
import ShadowBox from "@polar-sh/ui/components/atoms/ShadowBox";
import { Form } from "@polar-sh/ui/components/ui/form";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useForm } from "react-hook-form";

export default function WebhookContextView({
	organization,
	endpoint,
}: {
	organization: schemas["Organization"];
	endpoint: schemas["WebhookEndpoint"];
}) {
	const form = useForm<schemas["WebhookEndpointUpdate"]>({
		defaultValues: {
			...endpoint,
		},
	});

	const { handleSubmit } = form;
	const updateWebhookEndpoint = useEditWebhookEndpoint();

	const onSubmit = useCallback(
		async (form: schemas["WebhookEndpointUpdate"]) => {
			const { error } = await updateWebhookEndpoint.mutateAsync({
				id: endpoint.id,
				body: form,
			});
			if (error) {
				toast({
					title: "Webhook Endpoint Update Failed",
					description: `Error updating Webhook Endpoint: ${error.detail}`,
				});
				return;
			}
			toast({
				title: "Webhook Endpoint Updated",
				description: `Webhook Endpoint was updated successfully`,
			});
		},
		[endpoint, updateWebhookEndpoint],
	);

	return (
		<DashboardBody>
			<div className="flex flex-col gap-8">
				<Form {...form}>
					<form
						onSubmit={handleSubmit(onSubmit)}
						className="max-w-[700px] flex flex-col gap-y-4"
					>
						<FieldUrl />
						<FieldFormat />
						<FieldSecret isUpdate={true} />
						<FieldEvents />

						<Button
							type="submit"
							loading={updateWebhookEndpoint.isPending}
							disabled={updateWebhookEndpoint.isPending}
						>
							Save
						</Button>
					</form>
				</Form>
			</div>
		</DashboardBody>
	);
}
