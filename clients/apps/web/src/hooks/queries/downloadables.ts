import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { DownloadableRead, ListResourceDownloadableRead } from '@polar-sh/sdk'
import { defaultRetry } from './retry'

export const useDownloadables = (fileIds: string[]) =>
  useQuery({
    queryKey: ['user', 'downloadables', ...fileIds],
    queryFn: () =>
      api.downloadables
        .list({
          fileIds,
        })
        .then((response: ListResourceDownloadableRead) => {
          if (!response.items) {
            return response
          }

          let lookup: { [key: string]: DownloadableRead } = {}
          const downloadables = response.items.reduce(
            (lookup, downloadable) => {
              lookup[downloadable.file.id] = downloadable
              return lookup
            },
            lookup,
          )
          // Return in given ID order
          const sorted = fileIds
            .map((id) => downloadables[id])
            .filter((downloadable) => !!downloadable)

          return {
            items: sorted,
            pagination: response.pagination,
          }
        }),
    retry: defaultRetry,
  })
