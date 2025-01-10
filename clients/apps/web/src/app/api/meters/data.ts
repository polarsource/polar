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

export interface MeterEvent {
  id: string
  slug: string
  customerId: string
  value: number
  created_at: string
}

export const MOCKED_METER_EVENTS: MeterEvent[] = [
  {
    id: '1',
    slug: 'openai-input',
    customerId: '1',
    value: 10,
    created_at: new Date(Date.now() - 86400000).toISOString().split('T')[0],
  },
  {
    id: '2',
    slug: 'openai-input',
    customerId: '2',
    value: 20,
    created_at: new Date(Date.now() - 86400000).toISOString().split('T')[0],
  },
]

export const MOCKED_METERS: Meter[] = [
  {
    id: '1',
    name: 'OpenAI Input',
    slug: 'openai-input',
    status: 'active',
    aggregation_type: 'sum',
    get value() {
      return MOCKED_METER_EVENTS.filter(
        (event) => event.slug === 'openai-input',
      ).reduce((total, event) => total + event.value, 0)
    },
    created_at: '2024-07-01',
    updated_at: '2025-01-01',
  },
  {
    id: '2',
    name: 'OpenAI Output',
    slug: 'openai-output',
    status: 'active',
    aggregation_type: 'sum',
    get value() {
      return MOCKED_METER_EVENTS.filter(
        (event) => event.slug === 'openai-output',
      ).reduce((total, event) => total + event.value, 0)
    },
    created_at: '2024-03-14',
    updated_at: '2025-02-11',
  },
  {
    id: '3',
    name: 'OpenAI Total',
    slug: 'openai-total',
    status: 'disabled',
    aggregation_type: 'sum',
    get value() {
      return MOCKED_METER_EVENTS.filter(
        (event) => event.slug === 'openai-total',
      ).reduce((total, event) => total + event.value, 0)
    },
    created_at: '2023-11-23',
    updated_at: '2025-02-03',
  },
]
