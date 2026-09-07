import { ExperimentProvider } from '@/experiments/ExperimentProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react'
import {
  AppRouterContext,
  type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime'
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import type { PostHog } from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import type { ComponentProps, ReactNode } from 'react'
import { vi } from 'vitest'

export interface CapturedEvent {
  event: string
  properties?: Record<string, unknown>
}

export const createTestPostHog = () => {
  const events: CapturedEvent[] = []
  const client = {
    capture: (event: string, properties?: Record<string, unknown>) => {
      events.push({ event, properties })
    },
    get_distinct_id: () => 'test-distinct-id',
    identify: () => {},
    reset: () => {},
    set_config: () => {},
    config: {},
  } as unknown as PostHog
  return { client, events }
}

export const createTestRouter = (): AppRouterInstance => ({
  bfcacheId: 'test-router',
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
})

export interface ProvidersRenderResult extends RenderResult {
  router: AppRouterInstance
  posthog: ReturnType<typeof createTestPostHog>
  queryClient: QueryClient
}

export interface ProviderOptions {
  pathname?: string
  searchParams?: string
  experiments?: ComponentProps<typeof ExperimentProvider>['experiments']
}

export const renderWithProviders = (
  ui: ReactNode,
  {
    pathname = '/',
    searchParams = '',
    experiments = {},
    ...renderOptions
  }: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {},
): ProvidersRenderResult => {
  const router = createTestRouter()
  const posthog = createTestPostHog()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value={pathname}>
        <SearchParamsContext.Provider value={new URLSearchParams(searchParams)}>
          <PostHogProvider client={posthog.client}>
            <ExperimentProvider experiments={experiments}>
              <QueryClientProvider client={queryClient}>
                {children}
              </QueryClientProvider>
            </ExperimentProvider>
          </PostHogProvider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  )

  return {
    ...render(ui, { wrapper, ...renderOptions }),
    router,
    posthog,
    queryClient,
  }
}
