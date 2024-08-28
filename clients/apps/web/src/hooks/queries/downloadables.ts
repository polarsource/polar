import { useQuery } from '@tanstack/react-query'

import { api } from '@/utils/api'
import { DownloadableRead, ListResourceDownloadableRead } from '@polar-sh/sdk'
import { defaultRetry } from './retry'

export const useDownloadables = (benefitId: string, activeFileIds: string[]) =>
  useQuery({
    queryKey: ['user', 'downloadables', benefitId, ...activeFileIds],
    queryFn: () =>
      api.usersDownloadables
        .list({
          benefitId,
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
          const added: { [key: string]: boolean } = {}
          const sorted: DownloadableRead[] = []
          activeFileIds.map((id) => {
            sorted.push(downloadables[id])
            added[id] = true
          })
          response.items.map((item) => {
            if (item.file.id in added) {
              return
            }
            sorted.push(item)
          })

          return {
            items: sorted,
            pagination: response.pagination,
          }
        }),
    retry: defaultRetry,
  })
