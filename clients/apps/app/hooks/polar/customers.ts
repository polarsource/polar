import { usePolarClient } from "@/providers/PolarClientProvider";
import { CustomersListRequest } from "@polar-sh/sdk/models/operations/customerslist";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export const useCustomer = (organizationId: string | undefined, id: string) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: ["customers", organizationId, { id }],
    queryFn: () => polar.customers.get({ id }),
    enabled: !!organizationId,
  });
};

export const useCustomers = (
  organizationId: string | undefined,
  parameters?: Omit<CustomersListRequest, "organizationId">
) => {
  const { polar } = usePolarClient();

  return useInfiniteQuery({
    queryKey: ["customers", { organizationId, ...(parameters || {}) }],
    queryFn: ({ pageParam = 1 }) =>
      polar.customers.list({
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
