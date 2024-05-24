import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { FileRead } from '@polar-sh/sdk'
import { defaultRetry } from './retry'

import { useMutation } from '@tanstack/react-query'

export const useFiles = (organizationId: string, fileIds: string[]) =>
  useQuery({
    queryKey: ['user', 'files', organizationId, ...fileIds],
    queryFn: () =>
      api.files
        .list({
          organizationId,
          ids: fileIds,
        })
        .then((response) => {
          const files = response.items.reduce((lookup, file) => {
            lookup[file.id] = file
            return lookup
          }, {})
          // Return in given ID order
          const sorted = fileIds.map((id) => files[id]).filter((file) => !!file)
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
    mutationFn: ({ enabled }: { enabled: boolean }) => {
      return api.files
        .update({
          id: id,
          filePatch: {
            is_enabled: enabled,
          },
        })
        .then((res) => {})
    },
    onSuccess: (response: FileRead) => {
      if (onSuccessCallback) {
        onSuccessCallback(response)
      }
    },
  })

export const useDeleteFile = (id: string, onSuccessCallback?: () => void) =>
  useMutation({
    mutationFn: () => {
      return api.files._delete({
        id: id,
      })
    },
    onSuccess: () => {
      if (onSuccessCallback) {
        onSuccessCallback()
      }
    },
  })
