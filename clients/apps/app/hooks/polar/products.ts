import { usePolarClient } from "@/providers/PolarClientProvider";
import { queryClient } from "@/utils/query";
import { ProductUpdate } from "@polar-sh/sdk/models/components/productupdate.js";
import { ProductsListRequest } from "@polar-sh/sdk/models/operations/productslist.js";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

export const useProduct = (organizationId: string | undefined, id: string) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: ["product", organizationId, { id }],
    queryFn: () => polar.products.get({ id }),
    enabled: !!organizationId,
  });
};

export const useProducts = (
  organizationId: string | undefined,
  options: Omit<ProductsListRequest, "organizationId">
) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: ["products", organizationId, { ...options }],
    queryFn: () => polar.products.list({ organizationId, ...options }),
  });
};

export const useInfiniteProducts = (
  organizationId: string | undefined,
  options?: Omit<ProductsListRequest, "organizationId">
) => {
  const { polar } = usePolarClient();

  return useInfiniteQuery({
    queryKey: ["infinite", "products", organizationId, { ...options }],
    queryFn: ({ pageParam = 1 }) =>
      polar.products.list({ organizationId, ...options, page: pageParam }),
    enabled: !!organizationId,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.result.items.length === 0) return undefined;
      return pages.length + 1;
    },
  });
};

export const useProductUpdate = (
  organizationId: string | undefined,
  id: string
) => {
  const { polar } = usePolarClient();

  return useMutation({
    mutationFn: (data: ProductUpdate) =>
      polar.products.update({ id, productUpdate: data }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["product", organizationId, { id }], data);

      queryClient.invalidateQueries({
        queryKey: ["products", organizationId],
      });

      queryClient.invalidateQueries({
        queryKey: ["infinite", "products", organizationId],
      });
    },
  });
};
