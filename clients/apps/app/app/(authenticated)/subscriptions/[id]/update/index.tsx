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
import { useCallback, useContext, useEffect, useMemo } from "react";
import React from "react";
import { SubscriptionCancel } from "@polar-sh/sdk/models/components/subscriptioncancel.js";
import { Button } from "@/components/Shared/Button";
import {
  useForm,
  useFormContext,
  UseFormReturn,
  useFormState,
} from "react-hook-form";
import { SubscriptionRevoke } from "@polar-sh/sdk/models/components/subscriptionrevoke.js";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SubscriptionRow } from "@/components/Subscriptions/SubscriptionRow";
import { useQueryClient } from "@tanstack/react-query";
import { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import { useOrganization } from "@/hooks/polar/organizations";
import { SubscriptionUpdateProduct } from "@polar-sh/sdk/models/components/subscriptionupdateproduct.js";
import { hasLegacyRecurringPrices } from "@/utils/price";
import { useProducts } from "@/hooks/polar/products";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { SubscriptionProrationBehavior } from "@polar-sh/sdk/models/components/subscriptionprorationbehavior.js";
import { ProductPriceLabel } from "@/components/Products/ProductPriceLabel";
import { EmptyState } from "@/components/Shared/EmptyState";
import { ThemedText } from "@/components/Shared/ThemedText";

export default function Index() {
  const { organization } = useContext(OrganizationContext);
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();

  const {
    data: subscription,
    refetch,
    isRefetching,
  } = useSubscription(id as string);

  const updateSubscription = useUpdateSubscription(id as string);

  const form = useForm<SubscriptionUpdateProduct>({
    defaultValues: {
      prorationBehavior: "prorate",
    },
  });

  const { handleSubmit, watch, resetField, setValue } = form;

  const { data: allProducts } = useProducts(organization?.id ?? "", {
    isRecurring: true,
    limit: 100,
    sorting: ["price_amount"],
    isArchived: false,
  });

  const products = useMemo(
    () =>
      allProducts
        ? allProducts.result.items.filter(
            (product) => !hasLegacyRecurringPrices(product)
          )
        : [],
    [allProducts]
  );

  const selectedProductId = watch("productId");
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );

  const onSubmit = useCallback(
    async (body: SubscriptionUpdateProduct) => {
      await updateSubscription.mutateAsync(body).then(({ error }) => {
        console.log({ error });
        if (error) {
          Alert.alert(
            "Subscription update failed",
            `Error while updating subscription ${
              subscription?.product.name
            }: ${JSON.stringify({ error })}`
          );
          return;
        }

        router.back();
      });
    },
    [updateSubscription, subscription]
  );

  // Set default proration behavior from organization settings
  useEffect(() => {
    if (organization) {
      resetField("prorationBehavior", {
        defaultValue: organization.subscriptionSettings.prorationBehavior,
      });
    }
  }, [organization, resetField]);

  const productCandidates = useMemo(() => {
    return products.filter((product) => product.id !== subscription?.productId);
  }, [products, subscription]);

  if (!subscription) {
    return (
      <Stack.Screen
        options={{
          title: "Update Subscription",
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
          title: "Update Subscription",
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

        <ProrationBehaviorSelector form={form} />

        <View style={{ flex: 1, gap: 4 }}>
          {productCandidates.length > 0 ? (
            productCandidates.map((product) => (
              <TouchableOpacity
                key={product.id}
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
                  setValue("productId", product.id, { shouldDirty: true });
                }}
              >
                <ThemedText>{product.name}</ThemedText>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <ProductPriceLabel product={product} />
                  <MaterialIcons
                    name="check"
                    size={16}
                    color={colors.text}
                    style={{
                      opacity: product.id === selectedProductId ? 1 : 0,
                    }}
                  />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState
              title="No other products available"
              description="You have no other products to update to."
            />
          )}
        </View>
      </View>
      {selectedProduct && selectedProduct.id !== subscription.product.id && (
        <View
          style={{
            backgroundColor: colors.card,
            padding: 16,
            borderRadius: 8,
          }}
        >
          <ThemedText>
            The customer will get access to {selectedProduct.name} benefits, and
            lose access to {subscription.product.name} benefits.
          </ThemedText>
        </View>
      )}
      <Button
        loading={updateSubscription.isPending}
        disabled={updateSubscription.isPending || !selectedProductId}
        onPress={handleSubmit(onSubmit)}
      >
        Update Subscription
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

const PRORATION_BEHAVIOR_LABELS: Record<SubscriptionProrationBehavior, string> =
  {
    invoice: "Invoice Immediately",
    prorate: "Prorate next Invoice",
  };

const ProrationBehaviorSelector = ({
  form,
}: {
  form: UseFormReturn<SubscriptionUpdateProduct>;
}) => {
  const { colors } = useTheme();

  const { watch, setValue } = form;

  const prorationBehavior = watch("prorationBehavior");

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        backgroundColor: colors.card,
        padding: 4,
        borderRadius: 12,
      }}
    >
      {Object.entries(PRORATION_BEHAVIOR_LABELS).map(([key, label]) => (
        <TouchableOpacity
          key={key}
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
            prorationBehavior === key && {
              backgroundColor: colors.background,
            },
          ]}
          onPress={() => {
            setValue(
              "prorationBehavior",
              key as SubscriptionProrationBehavior,
              {
                shouldDirty: true,
              }
            );
          }}
        >
          <ThemedText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ width: "100%", textAlign: "center" }}
          >
            {label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
};
