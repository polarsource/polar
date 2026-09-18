import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import {
  activeDeploy,
  useVoidDeployConfiguration,
  useVoidDeploys,
  VoidConfigSignal,
} from './api'
import { useVoidDataSource } from './dataSource'
import { FIXTURE_SIGNALS } from './signals'

const NONE: VoidConfigSignal[] = []

export const useVoidSignals = () => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const deploysQuery = useVoidDeploys(organization.id, { enabled: live })
  const deploymentId =
    activeDeploy(deploysQuery.data ?? [], { withConfiguration: true })?.id ?? ''
  const configurationQuery = useVoidDeployConfiguration(
    organization.id,
    deploymentId,
    live,
  )

  return {
    signals: live ? (configurationQuery.data?.signals ?? NONE) : FIXTURE_SIGNALS,
    loading: live && (deploysQuery.isLoading || configurationQuery.isLoading),
    error: live ? (deploysQuery.error ?? configurationQuery.error) : null,
  }
}
