import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { usePolarClient } from "@/providers/PolarClientProvider";
import { OrdersListRequest } from "@polar-sh/sdk/models/operations/orderslist.js";

export const useOrder = (id: string) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: ["orders", { id }],
    queryFn: () => polar.orders.get({ id }),
  });
};

export const useOrders = (
  organizationId?: string,
  parameters?: Omit<OrdersListRequest, "organizationId">
) => {
  const { polar } = usePolarClient();

  return useInfiniteQuery({
    queryKey: ["orders", { organizationId, ...(parameters || {}) }],
    queryFn: ({ pageParam = 1 }) =>
      polar.orders.list({
        organizationId,
        ...(parameters || {}),
        page: pageParam,
      }),
    enabled: !!organizationId,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.result.items.length === 0) return undefined;
      return pages.length + 1;
    },
  });
};
