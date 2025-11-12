import { usePolarClient } from "@/providers/PolarClientProvider";
import { queryClient } from "@/utils/query";
import { OrganizationCreate } from "@polar-sh/sdk/models/components/organizationcreate.js";
import { OrganizationsGetRequest } from "@polar-sh/sdk/models/operations/organizationsget";
import { useMutation, useQuery } from "@tanstack/react-query";

export const useOrganizations = (
  {
    enabled = true,
  }: {
    enabled?: boolean;
  } = { enabled: true }
) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: ["organizations"],
    queryFn: () =>
      polar.organizations.list({
        limit: 100,
      }),
    enabled,
  });
};

export const useOrganization = (
  organizationId?: string,
  parameters?: Omit<OrganizationsGetRequest, "organizationId">
) => {
  const { polar } = usePolarClient();

  return useQuery({
    queryKey: ["organizations", { organizationId, ...(parameters || {}) }],
    queryFn: () => polar.orders.list({ organizationId, ...(parameters || {}) }),
    enabled: !!organizationId,
  });
};

export const useCreateOrganization = () => {
  const { polar } = usePolarClient();

  return useMutation({
    mutationFn: (organization: OrganizationCreate) =>
      polar.organizations.create(organization),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
};
