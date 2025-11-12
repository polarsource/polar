import { useNotifications } from "@/providers/NotificationsProvider";
import { useGetNotificationRecipient } from "./polar/notifications";
import { useSession } from "@/providers/SessionProvider";
import { useDeleteNotificationRecipient } from "./polar/notifications";
import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

export const useLogout = () => {
  const { setSession } = useSession();
  const { expoPushToken } = useNotifications();
  const router = useRouter();

  const deleteNotificationRecipient = useDeleteNotificationRecipient();
  const { data: notificationRecipient } =
    useGetNotificationRecipient(expoPushToken);

  const queryClient = useQueryClient();

  const signOut = useCallback(async () => {
    if (notificationRecipient) {
      deleteNotificationRecipient.mutateAsync(notificationRecipient.id);
    }

    Notifications.unregisterForNotificationsAsync();

    queryClient.clear();

    setSession(null);
    await AsyncStorage.removeItem("organizationId");

    router.replace("/");
  }, [
    setSession,
    deleteNotificationRecipient,
    expoPushToken,
    router,
    queryClient,
  ]);

  return signOut;
};

export const isDemoSession = () => {
  const { session } = useSession();
  return session === process.env.EXPO_PUBLIC_POLAR_DEMO_TOKEN;
};
