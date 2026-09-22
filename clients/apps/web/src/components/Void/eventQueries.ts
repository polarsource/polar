import { useQuery } from '@tanstack/react-query'
import { voidRequest, voidSearch } from './api'
import type { VoidEventTypeStat } from './events'
import { VoidEventsList } from './identityLive'

export interface VoidEventListParams {
  page?: number
  limit?: number
  name?: string
  external_identity_id?: string
}

export const eventKeys = {
  list: (organizationId: string, params: VoidEventListParams) => [
    'void_events',
    organizationId,
    params,
  ],
  types: (organizationId: string, identity?: string) => [
    'void_event_types',
    organizationId,
    identity,
  ],
}

export const useVoidEvents = (
  organizationId: string,
  params: VoidEventListParams,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: eventKeys.list(organizationId, params),
    queryFn: () =>
      voidRequest<VoidEventsList>(
        organizationId,
        `/events${voidSearch({
          page: params.page ? String(params.page) : undefined,
          limit: params.limit ? String(params.limit) : undefined,
          name: params.name,
          external_identity_id: params.external_identity_id,
        })}`,
      ),
    retry: false,
    ...options,
  })

export const useVoidEventTypes = (
  organizationId: string,
  identity?: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: eventKeys.types(organizationId, identity),
    queryFn: () =>
      voidRequest<VoidEventTypeStat[]>(
        organizationId,
        `/events/types${voidSearch({
          external_identity_id: identity,
        })}`,
      ),
    retry: false,
    ...options,
  })
