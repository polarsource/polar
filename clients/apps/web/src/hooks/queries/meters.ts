import { useQuery } from '@tanstack/react-query'

export interface Meter {
  id: string
  name: string
  slug: string
  status: 'active' | 'disabled'
  aggregation_type: 'sum' | 'count'
  value: number
  created_at: string
  updated_at: string
}

const MOCKED_METERS: Meter[] = [
  {
    id: '1',
    name: 'OpenAI Input',
    slug: 'openai-input',
    status: 'active',
    aggregation_type: 'sum',
    value: 98012839,
    created_at: '2024-07-01',
    updated_at: '2025-01-01',
  },
  {
    id: '2',
    name: 'OpenAI Output',
    slug: 'openai-output',
    status: 'active',
    aggregation_type: 'sum',
    value: 312313,
    created_at: '2024-03-14',
    updated_at: '2025-02-11',
  },
  {
    id: '3',
    name: 'OpenAI Total',
    slug: 'openai-total',
    status: 'disabled',
    aggregation_type: 'sum',
    value: 129244173,
    created_at: '2023-11-23',
    updated_at: '2025-02-03',
  },
]

export const useMeters = (organizationId?: string) =>
  useQuery({
    queryKey: ['meters', organizationId],
    queryFn: () => ({
      pagination: { total_count: MOCKED_METERS.length, max_page: 1 },
      items: MOCKED_METERS,
    }),
    enabled: !!organizationId,
  })

export const useMeter = (id?: string) =>
  useQuery({
    queryKey: ['meter', id],
    queryFn: () => MOCKED_METERS.find((meter) => meter.id === id),
    enabled: !!id,
  })
