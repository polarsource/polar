import { useUpdateOrganization } from "@/hooks/queries";
import { setValidationErrors } from "@/utils/api/errors";
import { isValidationError, schemas } from "@polar-sh/client";
import Button from "@polar-sh/ui/components/atoms/Button";
import Switch from "@polar-sh/ui/components/atoms/Switch";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@polar-sh/ui/components/ui/form";
import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "../Toast/use-toast";
import ProrationBehaviorRadioGroup from "./ProrationBehaviorRadioGroup";

interface OrganizationSubscriptionSettingsProps {
	organization: schemas["Organization"];
}

const OrganizationSubscriptionSettings: React.FC<
	OrganizationSubscriptionSettingsProps
> = ({ organization }) => {
	const form = useForm<schemas["OrganizationSubscriptionSettings"]>({
		defaultValues: organization.subscription_settings,
	});
	const { control, handleSubmit, setError, watch, reset, formState } = form;

	const allowCustomerUpdates = watch("allow_customer_updates");

	const updateOrganization = useUpdateOrganization();
	const onSubmit = async (
		subscription_settings: schemas["OrganizationSubscriptionSettings"],
	) => {
		const { data, error } = await updateOrganization.mutateAsync({
			id: organization.id,
			body: {
				subscription_settings,
				pledge_badge_show_amount: organization.pledge_badge_show_amount,
				pledge_minimum_amount: organization.pledge_minimum_amount,
			},
		});

		if (error) {
			if (isValidationError(error.detail)) {
				setValidationErrors(error.detail, setError);
			} else {
				setError("root", { message: error.detail });
			}
			return;
		}

		reset(data.subscription_settings);

		toast({
			title: "Settings Updated",
			description: `Settings were updated successfully`,
		});
	};

	return (
		<Form {...form}>
			<form
				className="dark:divide-polar-700 flex w-full flex-col gap-y-8"
				onSubmit={handleSubmit(onSubmit)}
			>
				<FormField
					control={control}
					name="allow_multiple_subscriptions"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center space-x-2 space-y-0">
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
							<FormLabel>
								Allow customers to have several active subscriptions
							</FormLabel>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={control}
					name="allow_customer_updates"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center space-x-2 space-y-0">
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
							<FormLabel>
								Allow customers to switch their subscription&apos;s price from
								the customer portal
							</FormLabel>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={control}
					name="proration_behavior"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Default proration setting</FormLabel>
							<ProrationBehaviorRadioGroup
								value={field.value}
								onValueChange={field.onChange}
							/>
							<FormMessage />
							{allowCustomerUpdates && (
								<FormDescription>
									This setting will be applied when customers switch their
									subscription&apos;s price from the customer portal
								</FormDescription>
							)}
						</FormItem>
					)}
				/>

				<Button
					className="self-start"
					type="submit"
					disabled={!formState.isDirty}
					loading={updateOrganization.isPending}
				>
					Save
				</Button>
			</form>
		</Form>
	);
};

export default OrganizationSubscriptionSettings;
