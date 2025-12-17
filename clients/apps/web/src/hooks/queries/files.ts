import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

type FileRead =
  | schemas['DownloadableFileRead']
  | schemas['ProductMediaFileRead']
  | schemas['OrganizationAvatarFileRead']

export const useFiles = (
  organizationId: string,
  fileIds: string[],
  options?: { limit?: number },
) =>
  useQuery({
    queryKey: ['user', 'files', JSON.stringify(fileIds)],
    queryFn: () =>
      unwrap(
        api.GET('/v1/files/', {
          params: {
            query: {
              organization_id: organizationId,
              ids: fileIds,
              limit: options?.limit ?? fileIds.length,
            },
          },
        }),
      ).then((response) => {
        const files = response.items.reduce<Record<string, FileRead>>(
          (lookup, file) => {
            lookup[file.id] = file
            return lookup
          },
          {},
        )
        // Return in given ID order
        const sorted = fileIds.map((id) => files?.[id]).filter((file) => !!file)
        return {
          items: sorted,
          pagination: response.pagination,
        }
      }),
    retry: defaultRetry,
  })

export const usePatchFile = (
  id: string,
  onSuccessCallback?: (res: FileRead) => void,
) =>
  useMutation({
    mutationFn: ({ name, version }: { name?: string; version?: string }) => {
      const patch: {
        name?: string
        version?: string
      } = {}
      if (name) {
        patch['name'] = name
      }
      if (version) {
        patch['version'] = version
      }
      return api.PATCH('/v1/files/{id}', {
        params: {
          path: { id },
        },
        body: patch,
      })
    },
    onSuccess: (response) => {
      if (response.error) {
        return
      }

      if (onSuccessCallback) {
        onSuccessCallback(response.data)
      }
      getQueryClient().invalidateQueries({ queryKey: ['user', 'files'] })
    },
  })

export const useDeleteFile = (id: string, onSuccessCallback?: () => void) =>
  useMutation({
    mutationFn: () =>
      api.DELETE('/v1/files/{id}', {
        params: {
          path: { id },
        },
      }),
    onSuccess: (response) => {
      if (response.error) {
        return
      }

      if (onSuccessCallback) {
        onSuccessCallback()
      }
      getQueryClient().invalidateQueries({ queryKey: ['user', 'files'] })
    },
  })
