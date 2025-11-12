import { ProductRow } from "@/components/Products/ProductRow";
import { ThemedText } from "@/components/Shared/ThemedText";
import { useInfiniteProducts } from "@/hooks/polar/products";
import { useTheme } from "@/hooks/theme";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { Product } from "@polar-sh/sdk/models/components/product";
import { Stack } from "expo-router";
import React, { useContext, useMemo } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

export default function Index() {
  const { organization } = useContext(OrganizationContext);
  const { colors } = useTheme();
  const { data, refetch, isRefetching, fetchNextPage, hasNextPage, isLoading } =
    useInfiniteProducts(organization?.id);

  const flatData = useMemo(() => {
    return (
      data?.pages
        .flatMap((page) => page.result.items)
        .sort((a, b) => (a.isArchived ? 1 : -1) - (b.isArchived ? 1 : -1)) ?? []
    );
  }, [data]);

  return (
    <>
      <Stack.Screen options={{ title: "Products" }} />
      <FlatList
        data={flatData}
        renderItem={({ item }: { item: Product }) => (
          <ProductRow product={item} />
        )}
        contentContainerStyle={{
          padding: 16,
          backgroundColor: colors.background,
          gap: 4,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          isLoading ? null : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ThemedText style={{ fontSize: 16 }} secondary>
                No Products
              </ThemedText>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl onRefresh={refetch} refreshing={isRefetching} />
        }
        onEndReached={() => {
          if (hasNextPage) {
            fetchNextPage();
          }
        }}
        contentInset={{ bottom: 32 }}
        onEndReachedThreshold={0.8}
      />
    </>
  );
}
