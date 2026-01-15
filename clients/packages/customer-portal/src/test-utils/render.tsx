import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { CustomerPortalProvider } from '../react/provider'

interface RenderWithProviderOptions {
  token?: string
  organizationId?: string
  organizationSlug?: string
  baseUrl?: string
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function createWrapper(options: RenderWithProviderOptions = {}) {
  const {
    token = 'test_token',
    organizationId = 'org_test123',
    organizationSlug = 'test-org',
    baseUrl = 'http://127.0.0.1:8000',
  } = options

  const queryClient = createTestQueryClient()

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <CustomerPortalProvider
          token={token}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          baseUrl={baseUrl}
          onUnauthorized={() => {}}
        >
          {children}
        </CustomerPortalProvider>
      </QueryClientProvider>
    )
  }
}
