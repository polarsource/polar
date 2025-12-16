import { Box } from '@/components/Shared/Box'
import { useOrganizations } from '@/hooks/polar/organizations'
import { useStorageState } from '@/hooks/storage'
import { ExtensionStorage } from '@bacons/apple-targets'
import { schemas } from '@polar-sh/client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect, usePathname } from 'expo-router'
import { createContext, PropsWithChildren, useEffect, useMemo } from 'react'
import { ActivityIndicator } from 'react-native'
import { useSession } from './SessionProvider'

const storage = new ExtensionStorage('group.com.polarsource.Polar')

export interface OrganizationContextValue {
  isLoading: boolean
  organization: schemas['Organization'] | undefined
  organizations: schemas['Organization'][]
  setOrganization: (organization: schemas['Organization']) => void
}

const stub = (): never => {
  throw new Error(
    'You forgot to wrap your component in <PolarOrganizationProvider>.',
  )
}

export const OrganizationContext =
  // @ts-ignore
  createContext<OrganizationContextValue>(stub)

export function PolarOrganizationProvider({ children }: PropsWithChildren) {
  const [[isStorageLoading, organizationId], setOrganizationId] =
    useStorageState('organizationId')

  const { session } = useSession()

  const pathname = usePathname()

  const { data: organizationData, isLoading: isLoadingOrganizations } =
    useOrganizations({
      enabled: !!session,
    })

  useEffect(() => {
    AsyncStorage.getItem('organizationId').then((organizationId) => {
      setOrganizationId(organizationId ?? null)
    })
  }, [setOrganizationId])

  useEffect(() => {
    if (!organizationData || organizationData.items.length === 0) {
      return
    }

    // If no organizationId is set, or the current organizationId doesn't match
    // any organization (e.g., after logging in with a different user), select the first one
    const currentOrgExists = organizationData.items.some(
      (org) => org.id === organizationId,
    )

    if (!organizationId || !currentOrgExists) {
      setOrganizationId(organizationData.items[0].id ?? null)
    }
  }, [organizationData, organizationId, setOrganizationId])

  const organization = useMemo(() => {
    return organizationData?.items.find(
      (organization) => organization.id === organizationId,
    )
  }, [organizationData, organizationId])

  useEffect(() => {
    if (organization) {
      storage.set('widget_organization_id', organization.id)
      storage.set('widget_organization_name', organization.name)
    }
  }, [organization])

  const isLoading = isStorageLoading || isLoadingOrganizations

  const organizations = organizationData?.items ?? []

  if (isLoading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" />
      </Box>
    )
  }

  if (organizations.length === 0 && pathname !== '/onboarding') {
    return <Redirect href="/onboarding" />
  }

  return (
    <OrganizationContext.Provider
      value={{
        isLoading,
        organization,
        organizations,
        setOrganization: (organization: schemas['Organization']) => {
          setOrganizationId(organization.id)

          AsyncStorage.setItem('organizationId', organization.id)
        },
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}
