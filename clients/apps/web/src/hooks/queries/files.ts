import { useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import { FileRead } from '@polar-sh/sdk'
import { defaultRetry } from './retry'

import { useMutation } from '@tanstack/react-query'

export const useFiles = (organizationId: string, fileIds: string[]) =>
  useQuery({
    queryKey: ['user', 'files', JSON.stringify(fileIds)],
    queryFn: () =>
      api.files
        .list({
          organizationId,
          ids: fileIds,
        })
        .then((response) => {
          const files = response.items?.reduce(
            (lookup: Record<string, FileRead>, file) => {
              lookup[file.id] = file
              return lookup
            },
            {},
          )
          // Return in given ID order
          const sorted = fileIds
            .map((id) => files?.[id])
            .filter((file) => !!file)
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

      return api.files.update({
        id: id,
        filePatch: patch,
      })
    },
    onSuccess: (response: FileRead) => {
      if (onSuccessCallback) {
        onSuccessCallback(response)
      }

      queryClient.invalidateQueries({ queryKey: ['user', 'files'] })
    },
  })

export const useDeleteFile = (id: string, onSuccessCallback?: () => void) =>
  useMutation({
    mutationFn: () => {
      return api.files.delete({
        id: id,
      })
    },
    onSuccess: () => {
      if (onSuccessCallback) {
        onSuccessCallback()
      }

      queryClient.invalidateQueries({ queryKey: ['user', 'files'] })
    },
  })
