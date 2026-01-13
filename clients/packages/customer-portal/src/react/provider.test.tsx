import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useCustomerPortalContext } from './context'
import { CustomerPortalProvider } from './provider'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

describe('CustomerPortalProvider', () => {
  const defaultProps = {
    token: 'test_token',
    organizationId: 'org_123',
    organizationSlug: 'test-org',
    onUnauthorized: vi.fn(),
  }

  it('renders children', () => {
    render(
      <TestWrapper>
        <CustomerPortalProvider {...defaultProps}>
          <div data-testid="child">Hello</div>
        </CustomerPortalProvider>
      </TestWrapper>,
    )

    expect(screen.getByTestId('child')).toBeDefined()
    expect(screen.getByText('Hello')).toBeDefined()
  })

  it('provides context values', () => {
    const { result } = renderHook(() => useCustomerPortalContext(), {
      wrapper: ({ children }) => (
        <TestWrapper>
          <CustomerPortalProvider {...defaultProps}>
            {children}
          </CustomerPortalProvider>
        </TestWrapper>
      ),
    })

    expect(result.current.organizationId).toBe('org_123')
    expect(result.current.organizationSlug).toBe('test-org')
    expect(result.current.client).toBeDefined()
  })

  it('provides a portal client with correct config', () => {
    const { result } = renderHook(() => useCustomerPortalContext(), {
      wrapper: ({ children }) => (
        <TestWrapper>
          <CustomerPortalProvider {...defaultProps}>
            {children}
          </CustomerPortalProvider>
        </TestWrapper>
      ),
    })

    expect(result.current.client.config.token).toBe('test_token')
    expect(result.current.client.config.organizationId).toBe('org_123')
  })
})

describe('useCustomerPortalContext', () => {
  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useCustomerPortalContext())
    }).toThrow(
      'useCustomerPortalContext must be used within a CustomerPortalProvider',
    )
  })
})
