import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { components, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

type FileRead =
  | components['schemas']['DownloadableFileRead']
  | components['schemas']['ProductMediaFileRead']
  | components['schemas']['OrganizationAvatarFileRead']

export const useFiles = (organizationId: string, fileIds: string[]) =>
  useQuery({
    queryKey: ['user', 'files', JSON.stringify(fileIds)],
    queryFn: () =>
      unwrap(
        api.GET('/v1/files/', {
          params: { query: { organization_id: organizationId, ids: fileIds } },
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
      let patch: {
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
      queryClient.invalidateQueries({ queryKey: ['user', 'files'] })
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
      queryClient.invalidateQueries({ queryKey: ['user', 'files'] })
    },
  })
