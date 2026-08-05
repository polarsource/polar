import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useMerchantMigrations = (organizationId: string) =>
  useQuery({
    queryKey: ['merchantMigrations', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/merchant-migrations/', {
          params: { query: { organization_id: organizationId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useMerchantMigration = (id: string) =>
  useQuery({
    queryKey: ['merchantMigration', { id }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/merchant-migrations/{id}', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateMerchantMigration = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['MerchantMigrationCreate']) =>
      api.POST('/v1/merchant-migrations/', { body }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      getQueryClient().invalidateQueries({
        queryKey: ['merchantMigrations', { organizationId }],
      })
    },
  })

export const useRunMerchantMigrationPrecheck = (id: string) =>
  useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/merchant-migrations/{id}/precheck', {
          params: { path: { id } },
        }),
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['merchantMigration', { id }],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['merchantMigrationRecords'],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['merchantMigrationCounts', { id }],
      })
    },
  })

interface ImportOptions {
  recordIds?: string[]
  excludeRecordIds?: string[]
}

export const useImportMerchantMigrationCatalog = (id: string) =>
  useMutation({
    mutationFn: (options: ImportOptions = {}) =>
      unwrap(
        api.POST('/v1/merchant-migrations/{id}/import', {
          params: { path: { id } },
          body: {
            ...(options.recordIds ? { record_ids: options.recordIds } : {}),
            ...(options.excludeRecordIds
              ? { exclude_record_ids: options.excludeRecordIds }
              : {}),
          },
        }),
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['merchantMigration', { id }],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['merchantMigrationRecords'],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['merchantMigrationCounts', { id }],
      })
    },
  })

export const useMigrationRecords = (
  id: string,
  params: {
    entity?: schemas['PrecheckEntity']
    status?: schemas['PrecheckRecordStatus']
    reasonLevel?: schemas['PrecheckReasonLevel']
    page: number
    limit: number
  },
) =>
  useQuery({
    queryKey: ['merchantMigrationRecords', { id, ...params }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/merchant-migrations/{id}/records', {
          params: {
            path: { id },
            query: {
              ...(params.entity ? { entity: params.entity } : {}),
              ...(params.status ? { status: params.status } : {}),
              ...(params.reasonLevel
                ? { reason_level: params.reasonLevel }
                : {}),
              page: params.page,
              limit: params.limit,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export type CountEntity = 'subscriptions' | 'products' | 'customers'

export interface EntityCount {
  importable: number
  skipped: number
}

const EMPTY_COUNT: EntityCount = { importable: 0, skipped: 0 }

export const useMigrationEntityCounts = (id: string) => {
  const query = useQuery({
    queryKey: ['merchantMigrationCounts', { id }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/merchant-migrations/{id}/counts', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

  const byEntity = new Map(
    query.data?.entities.map((entity) => [
      entity.entity,
      { importable: entity.importable, skipped: entity.skipped },
    ]),
  )
  const counts: Record<CountEntity, EntityCount> = {
    subscriptions: byEntity.get('subscriptions') ?? EMPTY_COUNT,
    products: byEntity.get('products') ?? EMPTY_COUNT,
    customers: byEntity.get('customers') ?? EMPTY_COUNT,
  }

  return {
    counts,
    attentionCount: query.data?.action_required ?? 0,
    blockers: query.data?.blockers ?? [],
    isLoading: query.isLoading,
    // A failed count would otherwise read as zero, which the caller can't tell
    // apart from an empty catalog.
    isError: query.isError,
  }
}
