import { API_URL, server } from '@/test-utils/server'
import { getQueryClient } from '@/utils/api/query'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { refresh, revalidateTag } from 'next/cache'
import { expect, it, vi } from 'vitest'
import { useUpdateOrganization } from './org'

vi.mock('next/cache', () => ({ refresh: vi.fn(), revalidateTag: vi.fn() }))

it('refreshes the dashboard and expires the portal slug after a settings save', async () => {
  const organization = { id: 'org_1', slug: 'acme', name: 'Acme' }
  server.use(
    http.patch(`${API_URL}/v1/organizations/${organization.id}`, () =>
      HttpResponse.json(organization),
    ),
  )
  const { result } = renderHook(useUpdateOrganization, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={getQueryClient()}>
        {children}
      </QueryClientProvider>
    ),
  })

  await act(() =>
    result.current.mutateAsync({
      id: organization.id,
      body: { name: organization.name },
    }),
  )

  expect(refresh).toHaveBeenCalledTimes(1)
  expect(revalidateTag).toHaveBeenCalledExactlyOnceWith('organizations:acme', {
    expire: 0,
  })
})
