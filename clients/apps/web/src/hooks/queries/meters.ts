import { useQuery } from '@tanstack/react-query'

export const useMeters = (organizationId?: string) =>
  useQuery({
    queryKey: ['meters', organizationId],
    queryFn: () => fetch('/api/meters').then((res) => res.json()),
    enabled: !!organizationId,
  })

export const useMeter = (slug?: string) =>
  useQuery({
    queryKey: ['meter', slug],
    queryFn: () => fetch(`/api/meters/${slug}`).then((res) => res.json()),
    enabled: !!slug,
  })

export const useMeterEvents = (slug?: string) =>
  useQuery({
    queryKey: ['meter-events', slug],
    queryFn: () =>
      fetch(`/api/meters/${slug}/events`).then((res) => res.json()),
    enabled: !!slug,
  })
