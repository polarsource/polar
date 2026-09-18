import { api } from '@/utils/client'
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query'

export type VoidDeployStatus = 'draft' | 'active' | 'archived'

export interface VoidDeploy {
  id: string | null
  version_id: string
  checksum: string
  applied: boolean
  status: VoidDeployStatus | null
  has_configuration: boolean
  entries: unknown[]
  created_at: string
}

export interface VoidRecurringPrice {
  type: 'recurring'
  interval: string
  interval_count: number
  amount: string
  currency: string
}

export interface VoidOneTimePrice {
  type: 'one_time'
  amount: string
  currency: string
}

export type VoidPrice = VoidRecurringPrice | VoidOneTimePrice

export interface VoidMeterTerms {
  included: number
  limit: 'hard' | 'soft' | 'unlimited'
  rollover_cap: number | null
}

export interface VoidConfigProduct {
  slug: string
  name: string
  description: string | null
  price: VoidPrice
  meters: (string | ({ slug: string } & VoidMeterTerms))[]
  entitlements: string[]
}

export interface VoidConfigMeter {
  slug: string
  reducer: string
  credit_reducer: string | null
  unit_amount: string
  currency: string
}

export interface VoidConfigSignalWindow {
  amount: number
  unit: 'minute' | 'hour' | 'day'
}

export interface VoidConfigMeterSignal {
  slug: string
  kind: 'meter'
  meter: string
  enter_below: number
  exit_at_least: number
}

export interface VoidConfigSemanticSignal {
  slug: string
  kind: 'semantic'
  meter: string
  when: string
  over: VoidConfigSignalWindow
  enter_above: number
  exit_below: number
}

export type VoidConfigSignal = VoidConfigMeterSignal | VoidConfigSemanticSignal

export interface VoidConfiguration {
  checksum: string
  reducers: unknown[]
  meters: VoidConfigMeter[]
  entitlements: unknown[]
  products: VoidConfigProduct[]
  signals: VoidConfigSignal[]
}

export interface VoidProductPatch {
  name?: string | null
  description?: string | null
  price?: VoidPrice | null
  meters?: Record<string, VoidMeterTerms>
}

export interface VoidScenarioPatch {
  products: Record<string, VoidProductPatch>
  meters: Record<string, { unit_amount?: string | null }>
}

export interface VoidScenario {
  id: string
  name: string
  base_version_id: string
  base_deployment_id: string
  patch: VoidScenarioPatch
  version_id: string
  deployment_id: string | null
  promoted_deployment_id: string | null
  base_configuration: VoidConfiguration
  configuration: VoidConfiguration
  created_at: string
  modified_at: string | null
}

export interface VoidScenarioCreate {
  name: string
  base_version_id: string
  patch?: VoidScenarioPatch
}

export interface VoidScenarioUpdate {
  name?: string
  patch?: VoidScenarioPatch
}

export class VoidRequestError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'VoidRequestError'
    this.status = status
  }
}

export const voidRequest = async <T>(
  organizationId: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> => {
  const response = await fetch(`${api.baseUrl}/v1/void${path}`, {
    method: init.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Polar-Organization-ID': organizationId,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail =
      typeof body?.detail === 'string'
        ? body.detail
        : (body?.detail?.[0]?.msg ?? response.statusText)
    throw new VoidRequestError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const voidSearch = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value)
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export const voidKeys = {
  deploys: (organizationId: string) => ['void_deploys', organizationId],
  deployConfiguration: (organizationId: string, deploymentId: string) => [
    'void_deploy_configuration',
    organizationId,
    deploymentId,
  ],
  scenarios: (organizationId: string) => ['void_scenarios', organizationId],
  identities: (organizationId: string) => ['void_identities', organizationId],
  identity: (organizationId: string, externalId: string) => [
    'void_identity',
    organizationId,
    externalId,
  ],
  customers: (organizationId: string) => ['void_customers', organizationId],
  identitySnapshot: (organizationId: string, externalId: string) => [
    'void_identity_snapshot',
    organizationId,
    externalId,
  ],
  identitySubscriptions: (organizationId: string, externalId: string) => [
    'void_identity_subscriptions',
    organizationId,
    externalId,
  ],
  identityEntitlements: (organizationId: string, externalId: string) => [
    'void_identity_entitlements',
    organizationId,
    externalId,
  ],
  identityEvents: (organizationId: string, externalId: string) => [
    'void_identity_events',
    organizationId,
    externalId,
  ],
  identityActivities: (organizationId: string, externalId: string) => [
    'void_identity_activities',
    organizationId,
    externalId,
  ],
  identityUsage: (organizationId: string) => [
    'void_identity_usage',
    organizationId,
  ],
  reducerMetrics: (organizationId: string) => [
    'void_reducer_metrics',
    organizationId,
  ],
  reducers: (organizationId: string) => ['void_reducers', organizationId],
  reducer: (organizationId: string, id: string) => [
    'void_reducer',
    organizationId,
    id,
  ],
  reducerSeries: (organizationId: string, id: string) => [
    'void_reducer_series',
    organizationId,
    id,
  ],
  meters: (organizationId: string) => ['void_meters', organizationId],
  meterDetail: (organizationId: string, id: string) => [
    'void_meter_detail',
    organizationId,
    id,
  ],
}

export const useVoidDeploys = (
  organizationId: string,
  options?: Pick<UseQueryOptions<VoidDeploy[]>, 'enabled'>,
) =>
  useQuery({
    queryKey: voidKeys.deploys(organizationId),
    queryFn: () => voidRequest<VoidDeploy[]>(organizationId, '/deploys'),
    retry: false,
    ...options,
  })

export const useVoidDeployConfiguration = (
  organizationId: string,
  deploymentId: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: voidKeys.deployConfiguration(organizationId, deploymentId),
    queryFn: () =>
      voidRequest<VoidConfiguration>(
        organizationId,
        `/deploys/${encodeURIComponent(deploymentId)}/configuration`,
      ),
    retry: false,
    enabled: enabled && deploymentId !== '',
  })

/** The active deployment, optionally only if its configuration is stored. */
export const activeDeploy = (
  deploys: VoidDeploy[],
  { withConfiguration = false } = {},
): VoidDeploy | undefined =>
  deploys.find(
    (deploy) =>
      deploy.status === 'active' &&
      (!withConfiguration || deploy.has_configuration),
  )

export const useVoidScenarios = (
  organizationId: string,
  options?: Pick<UseQueryOptions<VoidScenario[]>, 'enabled'>,
) =>
  useQuery({
    queryKey: voidKeys.scenarios(organizationId),
    queryFn: () => voidRequest<VoidScenario[]>(organizationId, '/scenarios'),
    retry: false,
    ...options,
  })

export const useVoidScenarioMutations = (organizationId: string) => {
  const queryClient = useQueryClient()
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: voidKeys.scenarios(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: voidKeys.deploys(organizationId),
      }),
    ])
  const setScenario = (scenario: VoidScenario) =>
    queryClient.setQueryData<VoidScenario[]>(
      voidKeys.scenarios(organizationId),
      (current) =>
        current?.some((b) => b.id === scenario.id)
          ? current.map((b) => (b.id === scenario.id ? scenario : b))
          : [scenario, ...(current ?? [])],
    )

  const create = useMutation({
    mutationFn: (body: VoidScenarioCreate) =>
      voidRequest<VoidScenario>(organizationId, '/scenarios', {
        method: 'POST',
        body,
      }),
    onSuccess: setScenario,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }: VoidScenarioUpdate & { id: string }) =>
      voidRequest<VoidScenario>(organizationId, `/scenarios/${id}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: setScenario,
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      voidRequest<void>(organizationId, `/scenarios/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, id) =>
      queryClient.setQueryData<VoidScenario[]>(
        voidKeys.scenarios(organizationId),
        (current) => current?.filter((b) => b.id !== id),
      ),
  })
  const promote = useMutation({
    mutationFn: (id: string) =>
      voidRequest<VoidDeploy>(organizationId, `/scenarios/${id}/promote`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  })
  return { create, update, remove, promote, setScenario }
}

/** The first seven characters of a hash; fixture labels pass through. */
export const shortVersion = (versionId: string) =>
  /^[0-9a-f]{64}$/.test(versionId) ? versionId.slice(0, 7) : versionId

/**
 * Sequential labels (v1, v2, …) in deployment order. Deployments form one
 * chronological list per organization and are never deleted, so the
 * position is stable; the hash stays the identity, this is only the name.
 */
export const versionLabels = (deploys: VoidDeploy[]): Map<string, string> =>
  new Map(
    [...deploys]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((deploy, index) => [deploy.version_id, `v${index + 1}`]),
  )

export const versionLabel = (
  labels: Map<string, string>,
  versionId: string,
): string => labels.get(versionId) ?? shortVersion(versionId)
