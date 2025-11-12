import { useTheme } from "@/hooks/theme";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  useSubscription,
  useUpdateSubscription,
} from "@/hooks/polar/subscriptions";
import { useCallback } from "react";
import React from "react";
import { SubscriptionCancel } from "@polar-sh/sdk/models/components/subscriptioncancel.js";
import { Button } from "@/components/Shared/Button";
import { useForm } from "react-hook-form";
import { SubscriptionRevoke } from "@polar-sh/sdk/models/components/subscriptionrevoke.js";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SubscriptionRow } from "@/components/Subscriptions/SubscriptionRow";
import { useQueryClient } from "@tanstack/react-query";
import { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { ThemedText } from "@/components/Shared/ThemedText";

const CANCELLATION_REASONS = {
  unused: "Unused",
  too_expensive: "Too Expensive",
  missing_features: "Missing Features",
  switched_service: "Switched Service",
  customer_service: "Customer Service",
  low_quality: "Low Quality",
  too_complex: "Too Complicated",
  other: "Other",
} as const;

const getHumanCancellationReason = (key: keyof typeof CANCELLATION_REASONS) => {
  if (key && key in CANCELLATION_REASONS) {
    return CANCELLATION_REASONS[key];
  }
  return null;
};

type CancellationAction = "revoke" | "cancel_at_period_end";

type SubscriptionCancelForm = SubscriptionCancel & {
  cancellation_action: CancellationAction;
};

export default function Index() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();

  const {
    data: subscription,
    refetch,
    isRefetching,
  } = useSubscription(id as string);

  const cancelSubscription = useUpdateSubscription(id as string);
  const form = useForm<SubscriptionCancelForm>({
    defaultValues: {
      cancellation_action: "cancel_at_period_end",
      customerCancellationReason: undefined,
    },
  });

  const { handleSubmit, setValue, watch } = form;

  const cancellationAction = watch("cancellation_action");
  const cancellationReason = watch("customerCancellationReason");

  const onSubmit = useCallback(
    async (cancellation: SubscriptionCancelForm) => {
      const base = {
        customerCancellationReason: cancellation.customerCancellationReason,
      };
      let body: SubscriptionRevoke | SubscriptionCancel;
      if (cancellation.cancellation_action === "revoke") {
        body = {
          ...base,
          revoke: true,
        };
      } else {
        body = {
          ...base,
          cancelAtPeriodEnd: true,
        };
      }

      await cancelSubscription.mutateAsync(body).then(({ error }) => {
        if (error) {
          if (error.detail) {
            Alert.alert(
              "Customer Update Failed",
              `Error cancelling subscription ${subscription?.product.name}: ${error.detail}`
            );
          }
          return;
        }

        router.back();
      });
    },
    [subscription, cancelSubscription]
  );

  const reasons = Object.keys(CANCELLATION_REASONS) as Array<
    keyof typeof CANCELLATION_REASONS
  >;

  let periodEndOutput: string | undefined = undefined;

  if (subscription?.currentPeriodEnd) {
    periodEndOutput = new Date(
      subscription.currentPeriodEnd
    ).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (!subscription) {
    return (
      <Stack.Screen
        options={{
          title: "Cancel Subscription",
        }}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ flexDirection: "column", gap: 16 }}
      refreshControl={
        <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
      }
      contentInset={{ bottom: 48 }}
    >
      <Stack.Screen
        options={{
          title: "Cancel Subscription",
        }}
      />
      <View style={{ gap: 24 }}>
        <SubscriptionRow
          subscription={subscription}
          showCustomer
          style={{
            backgroundColor: colors.card,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            backgroundColor: colors.card,
            padding: 4,
            borderRadius: 12,
          }}
        >
          {["Immediately", "End of Period"].map((option, index) => (
            <TouchableOpacity
              key={option}
              activeOpacity={0.6}
              style={[
                {
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  flex: 1,
                },
                cancellationAction ===
                  (index === 0 ? "revoke" : "cancel_at_period_end") && {
                  backgroundColor: colors.background,
                },
              ]}
              onPress={() => {
                setValue(
                  "cancellation_action",
                  index === 0 ? "revoke" : "cancel_at_period_end"
                );
              }}
            >
              <ThemedText>{option}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flex: 1, gap: 12 }}>
          <ThemedText style={{ fontSize: 16 }}>
            Customer Cancellation Reason
          </ThemedText>
          <View style={{ flex: 1, gap: 4 }}>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  backgroundColor: colors.card,
                  height: 48,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                }}
                onPress={() => {
                  setValue("customerCancellationReason", reason);
                }}
              >
                <ThemedText>{getHumanCancellationReason(reason)}</ThemedText>
                {cancellationReason === reason && (
                  <View>
                    <MaterialIcons name="check" size={20} color={colors.text} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      <Button
        loading={cancelSubscription.isPending}
        disabled={cancelSubscription.isPending}
        onPress={handleSubmit(onSubmit)}
      >
        Cancel Subscription
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
