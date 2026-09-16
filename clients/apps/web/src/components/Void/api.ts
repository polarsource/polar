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

export interface VoidConfiguration {
  checksum: string
  reducers: unknown[]
  meters: VoidConfigMeter[]
  entitlements: unknown[]
  products: VoidConfigProduct[]
}

export interface VoidProductPatch {
  name?: string | null
  description?: string | null
  price?: VoidPrice | null
  meters?: Record<string, VoidMeterTerms>
}

export interface VoidBranchPatch {
  products: Record<string, VoidProductPatch>
  meters: Record<string, { unit_amount?: string | null }>
}

export interface VoidBranch {
  id: string
  name: string
  base_version_id: string
  base_deployment_id: string
  patch: VoidBranchPatch
  version_id: string
  deployment_id: string | null
  promoted_deployment_id: string | null
  base_configuration: VoidConfiguration
  configuration: VoidConfiguration
  created_at: string
  modified_at: string | null
}

export interface VoidBranchCreate {
  name: string
  base_version_id: string
  patch?: VoidBranchPatch
}

export interface VoidBranchUpdate {
  name?: string
  patch?: VoidBranchPatch
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

export const voidKeys = {
  deploys: (organizationId: string) => ['void_deploys', organizationId],
  branches: (organizationId: string) => ['void_branches', organizationId],
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

export const useVoidBranches = (organizationId: string) =>
  useQuery({
    queryKey: voidKeys.branches(organizationId),
    queryFn: () => voidRequest<VoidBranch[]>(organizationId, '/branches'),
    retry: false,
  })

export const useVoidBranchMutations = (organizationId: string) => {
  const queryClient = useQueryClient()
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: voidKeys.branches(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: voidKeys.deploys(organizationId),
      }),
    ])
  const setBranch = (branch: VoidBranch) =>
    queryClient.setQueryData<VoidBranch[]>(
      voidKeys.branches(organizationId),
      (current) =>
        current?.some((b) => b.id === branch.id)
          ? current.map((b) => (b.id === branch.id ? branch : b))
          : [branch, ...(current ?? [])],
    )

  const create = useMutation({
    mutationFn: (body: VoidBranchCreate) =>
      voidRequest<VoidBranch>(organizationId, '/branches', {
        method: 'POST',
        body,
      }),
    onSuccess: setBranch,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }: VoidBranchUpdate & { id: string }) =>
      voidRequest<VoidBranch>(organizationId, `/branches/${id}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: setBranch,
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      voidRequest<void>(organizationId, `/branches/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, id) =>
      queryClient.setQueryData<VoidBranch[]>(
        voidKeys.branches(organizationId),
        (current) => current?.filter((b) => b.id !== id),
      ),
  })
  const promote = useMutation({
    mutationFn: (id: string) =>
      voidRequest<VoidDeploy>(organizationId, `/branches/${id}/promote`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  })
  return { create, update, remove, promote, setBranch }
}

export const shortVersion = (versionId: string) => versionId.slice(0, 7)
