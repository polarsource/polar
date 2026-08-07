import { extractApiErrorMessage } from '@/utils/api/errors'
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

const panTransferKey = (id: string) => ['merchantMigrationPanTransfer', { id }]

export const usePanTransfer = (id: string) =>
  useQuery({
    queryKey: panTransferKey(id),
    queryFn: () =>
      unwrap(
        api.GET('/v1/merchant-migrations/{id}/pan-transfer', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

// The list card draws its own position from the migration, so it goes stale
// alongside the detail view on every write.
const invalidateMigration = (id: string) => {
  getQueryClient().invalidateQueries({
    queryKey: ['merchantMigration', { id }],
  })
  getQueryClient().invalidateQueries({ queryKey: ['merchantMigrations'] })
}

// Written straight into the cache: waiting for a refetch leaves the finished
// step on screen with its button live, long enough to submit it twice.
const syncPanTransfer = (
  id: string,
  checklist: schemas['PanTransferChecklist'],
) => {
  getQueryClient().setQueryData(panTransferKey(id), checklist)
  invalidateMigration(id)
}

// Not `unwrap` like its neighbours: that reads `message`, the API reports
// `detail`, and these two surface the server's wording to the merchant.
const checklistOrThrow = (
  result: {
    data?: schemas['PanTransferChecklist']
    error?: { detail?: unknown }
  },
  fallback: string,
): schemas['PanTransferChecklist'] => {
  if (result.error || !result.data) {
    throw new Error(extractApiErrorMessage(result.error ?? {}, fallback))
  }
  return result.data
}

// A step can move from the backoffice or another tab, so a conflict means our
// view is stale. Refetch the migration too: the page picks its view from it,
// and otherwise the start button stays live and keeps failing the same way.
const panTransferHandlers = (id: string) => ({
  onSuccess: (checklist: schemas['PanTransferChecklist']) =>
    syncPanTransfer(id, checklist),
  onError: () => {
    getQueryClient().invalidateQueries({ queryKey: panTransferKey(id) })
    invalidateMigration(id)
  },
})

export const useStartPanTransfer = (id: string) =>
  useMutation({
    mutationFn: async () =>
      checklistOrThrow(
        await api.POST('/v1/merchant-migrations/{id}/pan-transfer', {
          params: { path: { id } },
        }),
        "We couldn't start the card transfer.",
      ),
    ...panTransferHandlers(id),
  })

export const useCompletePanTransferStep = (id: string) =>
  useMutation({
    mutationFn: async ({
      key,
      inputs,
    }: {
      key: string
      inputs: Record<string, string>
    }) =>
      checklistOrThrow(
        await api.POST(
          '/v1/merchant-migrations/{id}/pan-transfer/steps/{key}/complete',
          { params: { path: { id, key } }, body: { inputs } },
        ),
        "We couldn't save this step.",
      ),
    ...panTransferHandlers(id),
  })

export const useMigrationRecords = (
  id: string,
  params: {
    entity?: schemas['PrecheckEntity']
    status?: schemas['PrecheckRecordStatus']
    reasonLevel?: schemas['PrecheckReasonLevel']
    importStatus?: schemas['MerchantMigrationRecordStatus']
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
              ...(params.importStatus
                ? { import_status: params.importStatus }
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
