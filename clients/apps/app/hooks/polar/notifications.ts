import { useSession } from "@/providers/SessionProvider";
import { queryClient } from "@/utils/query";
import {
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { Platform } from "react-native";

export interface NotificationRecipient {
  id: string;
  expo_push_token: string;
  platform: "ios" | "android";
  created_at: string;
  updated_at: string;
}

export const useCreateNotificationRecipient = (): UseMutationResult<
  NotificationRecipient,
  Error,
  string
> => {
  const { session } = useSession();

  return useMutation({
    mutationFn: async (expoPushToken: string) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications/recipients`,
        {
          method: "POST",
          body: JSON.stringify({
            expo_push_token: expoPushToken,
            platform: Platform.OS,
          }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session}`,
          },
        }
      );

      return response.json();
    },
  });
};

export const useListNotificationRecipients = (): UseQueryResult<
  NotificationRecipient[],
  Error
> => {
  const { session } = useSession();

  return useQuery({
    queryKey: ["notification_recipients"],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications/recipients`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session}`,
          },
        }
      );

      return response.json();
    },
  });
};

export const useGetNotificationRecipient = (
  expoPushToken: string
): UseQueryResult<NotificationRecipient, Error> => {
  const { session } = useSession();

  return useQuery({
    queryKey: ["notification_recipient", expoPushToken],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications/recipients?expo_push_token=${expoPushToken}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session}`,
          },
        }
      );

      return response.json().then((data) => data.items[0]);
    },
    enabled: !!expoPushToken,
  });
};

export const useDeleteNotificationRecipient = (): UseMutationResult<
  NotificationRecipient,
  Error,
  string
> => {
  const { session } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications/recipients/${id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session}`,
          },
        }
      );

      return response.json();
    },
  });
};

export type MaintainerAccountUnderReviewNotificationPayload = {
  account_type: string;
};

export type MaintainerAccountReviewedNotificationPayload = {
  account_type: string;
};

export type MaintainerCreateAccountNotificationPayload = {
  organization_name: string;
  url: string;
};

export type MaintainerNewPaidSubscriptionNotificationPayload = {
  subscriber_name: string;
  tier_name: string;
  tier_price_amount: number | null;
  tier_price_recurring_interval: string;
  tier_organization_name: string;
};

export type MaintainerNewProductSaleNotificationPayload = {
  customer_name: string;
  product_name: string;
  product_price_amount: number;
  organization_name: string;
};

export type Notification = {
  id: string;
  created_at: string;
  type:
    | "MaintainerAccountUnderReview"
    | "MaintainerAccountReviewed"
    | "MaintainerCreateAccount"
    | "MaintainerNewPaidSubscription"
    | "MaintainerNewProductSale";
  payload:
    | MaintainerAccountUnderReviewNotificationPayload
    | MaintainerAccountReviewedNotificationPayload
    | MaintainerCreateAccountNotificationPayload
    | MaintainerNewPaidSubscriptionNotificationPayload
    | MaintainerNewProductSaleNotificationPayload;
};

export const useListNotifications = (): UseQueryResult<
  {
    notifications: Notification[];
    last_read_notification_id: string;
  },
  Error
> => {
  const { session } = useSession();

  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session}`,
          },
        }
      );

      return response.json();
    },
  });
};

export const useNotificationsMarkRead = () => {
  const { session } = useSession();

  return useMutation({
    mutationFn: async (variables: { notificationId: string }) => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/notifications/read`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session}`,
          },
          body: JSON.stringify({
            notification_id: variables.notificationId,
          }),
        }
      );

      return response.json();
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};
