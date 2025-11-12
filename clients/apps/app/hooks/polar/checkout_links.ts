import { usePolarClient } from "@/providers/PolarClientProvider";
import { CheckoutLinksListRequest } from "@polar-sh/sdk/models/operations/checkoutlinkslist.js";
import { useQuery } from "@tanstack/react-query";

export const useCheckoutLinks = (
  organizationId: string | undefined,
  params: Omit<CheckoutLinksListRequest, "organizationId">
) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: ["checkout_links", organizationId, { ...params }],
    queryFn: () =>
      polar.checkoutLinks.list({
        organizationId,
        ...params,
      }),
    enabled: !!organizationId,
  });
};
