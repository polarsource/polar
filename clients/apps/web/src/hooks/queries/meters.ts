import { Meter, MeterEvent } from '@/app/api/meters/data'
import { Pagination } from '@polar-sh/sdk'
import { useQuery } from '@tanstack/react-query'

export const useMeters = (organizationId?: string) =>
  useQuery({
    queryKey: ['meters', organizationId],
    queryFn: () =>
      fetch('/api/meters').then((res) => res.json()) as Promise<{
        items: Meter[]
        pagination: Pagination
      }>,
    enabled: !!organizationId,
  })

export const useMeter = (slug?: string) =>
  useQuery({
    queryKey: ['meter', slug],
    queryFn: () =>
      fetch(`/api/meters/${slug}`).then((res) => res.json()) as Promise<Meter>,
    enabled: !!slug,
  })

export const useMeterEvents = (slug?: string) =>
  useQuery({
    queryKey: ['meter-events', slug],
    queryFn: () =>
      fetch(`/api/meters/${slug}/events`).then(
        (res) =>
          res.json() as Promise<{
            items: MeterEvent[]
            pagination: Pagination
          }>,
      ),
    enabled: !!slug,
  })
