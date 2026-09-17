import { useQuery } from '@tanstack/react-query'
import { voidRequest, voidSearch } from './api'
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
  names: (organizationId: string, identity?: string) => [
    'void_event_names',
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

export const useVoidEventNames = (
  organizationId: string,
  identity?: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: eventKeys.names(organizationId, identity),
    queryFn: () =>
      voidRequest<VoidEventsList>(
        organizationId,
        `/events${voidSearch({
          page: '1',
          limit: '200',
          external_identity_id: identity,
        })}`,
      ),
    retry: false,
    ...options,
  })
