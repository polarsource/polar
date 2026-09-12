import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server, API_URL } from '@/test-utils/server'

type Migration = {
  id: string
  created_at: string
  modified_at: string | null
  organization_id: string
  source_platform: 'stripe'
  step:
    | 'source_setup'
    | 'pre_check'
    | 'create_catalog'
    | 'copy_cards'
    | 'activate_subscriptions'
    | 'cleanup'
    | 'completed'
  source_connected: boolean
  source: Record<string, unknown> | null
  operation: unknown | null
}

function migration(
  step: Migration['step'],
  overrides: Partial<Migration> = {},
): Migration {
  return {
    id: 'mig_1',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: null,
    organization_id: 'org_1',
    source_platform: 'stripe',
    step,
    source_connected: true,
    source: null,
    operation: null,
    ...overrides,
  }
}

const { getQueryClientMock } = vi.hoisted(() => ({
  getQueryClientMock: vi.fn(),
}))

vi.mock('@/utils/api/query', () => ({
  getQueryClient: () => getQueryClientMock(),
}))

import {
  useMerchantMigrations,
  useMigrationSwitch,
  useStartMigrationSwitch,
} from './merchantMigrations'

const switchKey = (id: string) => ['merchantMigrationSwitch', { id }]

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

const cutoverReport = (
  running: boolean,
  overrides: Record<string, unknown> = {},
) => ({
  started: true,
  running,
  completed: !running,
  total: 5,
  pending: running ? 5 : 0,
  moved: running ? 0 : 5,
  skipped: 0,
  failed: 0,
  ...overrides,
})

describe('useStartMigrationSwitch — list invalidation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = makeClient()
    server.resetHandlers()
    getQueryClientMock.mockReturnValue(queryClient)
  })

  const wrapper = (client: QueryClient) =>
    function TestWrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    }

  it('writes the cutover report and invalidates the migrations list', async () => {
    let listFetches = 0
    server.use(
      http.get(`${API_URL}/v1/merchant-migrations/`, () => {
        listFetches += 1
        return HttpResponse.json({
          items: [migration('activate_subscriptions')],
          pagination: { total_count: 1, max_page: 1 },
        })
      }),
      http.get(`${API_URL}/v1/merchant-migrations/mig_1/cutover`, () =>
        HttpResponse.json(cutoverReport(false)),
      ),
      http.post(`${API_URL}/v1/merchant-migrations/mig_1/cutover`, () =>
        HttpResponse.json(cutoverReport(true)),
      ),
    )

    const listHook = renderHook(() => useMerchantMigrations('org_1'), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true))
    expect(listFetches).toBe(1)

    const switchHook = renderHook(() => useMigrationSwitch('mig_1'), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(switchHook.result.current.isSuccess).toBe(true))

    const startHook = renderHook(() => useStartMigrationSwitch('mig_1'), {
      wrapper: wrapper(queryClient),
    })
    startHook.result.current.mutate({})
    await waitFor(() => expect(startHook.result.current.isSuccess).toBe(true))

    expect(queryClient.getQueryData(switchKey('mig_1'))).toMatchObject({
      running: true,
    })

    await waitFor(() => expect(listFetches).toBe(2))
  })
})
