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

const useEntityCount = (
  id: string,
  entity: CountEntity,
): EntityCount & {
  isLoading: boolean
  isError: boolean
} => {
  const importable = useMigrationRecords(id, {
    entity,
    status: 'importable',
    page: 1,
    limit: 1,
  })
  const skipped = useMigrationRecords(id, {
    entity,
    status: 'skipped',
    page: 1,
    limit: 1,
  })
  return {
    importable: importable.data?.pagination.total_count ?? 0,
    skipped: skipped.data?.pagination.total_count ?? 0,
    isLoading: importable.isLoading || skipped.isLoading,
    // A failed count would otherwise read as zero, which the caller can't tell
    // apart from an empty catalog.
    isError: importable.isError || skipped.isError,
  }
}

export const useMigrationEntityCounts = (id: string) => {
  const subscriptions = useEntityCount(id, 'subscriptions')
  const products = useEntityCount(id, 'products')
  const customers = useEntityCount(id, 'customers')
  const attention = useMigrationRecords(id, {
    reasonLevel: 'action_required',
    page: 1,
    limit: 1,
  })

  const counts: Record<CountEntity, EntityCount> = {
    subscriptions: {
      importable: subscriptions.importable,
      skipped: subscriptions.skipped,
    },
    products: { importable: products.importable, skipped: products.skipped },
    customers: { importable: customers.importable, skipped: customers.skipped },
  }

  return {
    counts,
    attentionCount: attention.data?.pagination.total_count ?? 0,
    isLoading:
      subscriptions.isLoading ||
      products.isLoading ||
      customers.isLoading ||
      attention.isLoading,
    isError:
      subscriptions.isError ||
      products.isError ||
      customers.isError ||
      attention.isError,
  }
}
