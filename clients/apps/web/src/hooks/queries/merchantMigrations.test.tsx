import { getQueryClient } from '@/utils/api/query'
import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCreateMerchantMigration } from './merchantMigrations'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/utils/client', () => ({ api: { POST: post } }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={getQueryClient()}>
    {children}
  </QueryClientProvider>
)

const created = {
  id: 'migration_1',
  step: 'source_setup',
  source_connected: true,
  operation: {
    status: 'pending',
    kind: 'precheck',
    stalled: false,
    error: null,
  },
}

describe('useCreateMerchantMigration', () => {
  beforeEach(() => {
    getQueryClient().clear()
    post.mockReset()
  })

  it('caches the new migration with its pre-check already running', async () => {
    post.mockResolvedValue({ data: created })
    const { result } = renderHook(() => useCreateMerchantMigration('org_1'), {
      wrapper,
    })

    result.current.mutate({
      organization_id: 'org_1',
      source_platform: 'stripe',
      api_key: 'rk_test_123',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(
      getQueryClient().getQueryData([
        'merchantMigration',
        { id: 'migration_1' },
      ]),
    ).toEqual(created)
  })

  it('caches nothing when the key is rejected', async () => {
    post.mockResolvedValue({ error: { detail: 'Invalid key' } })
    const { result } = renderHook(() => useCreateMerchantMigration('org_1'), {
      wrapper,
    })

    result.current.mutate({
      organization_id: 'org_1',
      source_platform: 'stripe',
      api_key: 'rk_test_123',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(
      getQueryClient().getQueriesData({ queryKey: ['merchantMigration'] }),
    ).toEqual([])
  })
})
