import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { FileRead } from '@polar-sh/sdk'
import { defaultRetry } from './retry'

import { useMutation } from '@tanstack/react-query'

export const useFiles = (organizationId: string, benefitId: string) =>
  useQuery({
    queryKey: ['user', 'files', organizationId, benefitId],
    queryFn: () =>
      api.files.listDownloadables({
        organizationId,
        benefitId,
      }),
    retry: defaultRetry,
  })

export const usePatchFile = (
  id: string,
  onSuccessCallback?: (res: FileRead) => void,
) =>
  useMutation({
    mutationFn: ({ enabled }: { enabled: boolean }) => {
      return api.files.update({
        id: id,
        filePatch: {
          is_enabled: enabled,
        },
      })
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
