import { useOrganizations } from "@/hooks/polar/organizations";
import { createContext, PropsWithChildren, useEffect, useMemo } from "react";
import { Organization } from "@polar-sh/sdk/models/components/organization.js";
import { useStorageState } from "@/hooks/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "./SessionProvider";
import { Redirect, usePathname } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export interface OrganizationContextValue {
  isLoading: boolean;
  organization: Organization | undefined;
  organizations: Organization[];
  setOrganization: (organization: Organization) => void;
}

const stub = (): never => {
  throw new Error(
    "You forgot to wrap your component in <PolarOrganizationProvider>."
  );
};

export const OrganizationContext =
  // @ts-ignore
  createContext<OrganizationContextValue>(stub);

export function PolarOrganizationProvider({ children }: PropsWithChildren) {
  const [[isStorageLoading, organizationId], setOrganizationId] =
    useStorageState("organizationId");

  const { session } = useSession();

  const pathname = usePathname();

  const { data: organizationData, isFetching: isFetchingOrganizations } =
    useOrganizations({
      enabled: !!session,
    });

  useEffect(() => {
    AsyncStorage.getItem("organizationId").then((organizationId) => {
      setOrganizationId(organizationId ?? null);
    });
  }, []);

  useEffect(() => {
    if (!organizationId) {
      if (organizationData && organizationData.result.items.length > 0) {
        setOrganizationId(organizationData.result.items[0].id ?? null);
      }
    }
  }, [organizationData, organizationId, setOrganizationId]);

  const organization = useMemo(() => {
    return organizationData?.result.items.find(
      (organization) => organization.id === organizationId
    );
  }, [organizationData, organizationId]);

  const isLoading = isStorageLoading || isFetchingOrganizations;

  const organizations = organizationData?.result.items ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (organizations.length === 0 && pathname !== "/onboarding") {
    return <Redirect href="/onboarding" />;
  }

  return (
    <OrganizationContext.Provider
      value={{
        isLoading,
        organization,
        organizations,
        setOrganization: (organization: Organization) => {
          setOrganizationId(organization.id);

          AsyncStorage.setItem("organizationId", organization.id);
        },
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
