import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrecheckPanel } from './PrecheckPanel'

// The retry mutation's `onSuccess` writes the updated migration through
// `getQueryClient()`, not the context client. Sharing one client between
// the provider and the mocked singleton keeps the cache write observable
// here, matching how `MigrationDetailPage` re-renders `PrecheckPanel` from
// the cache it reads via `useMerchantMigration`.
const queryClientHolder = vi.hoisted(() => ({
  current: null as QueryClient | null,
}))

vi.mock('@/utils/api/query', () => ({
  getQueryClient: () => queryClientHolder.current,
}))

vi.mock('@/utils/client', () => ({
  api: {
    POST: vi.fn(),
  },
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const { api } = await import('@/utils/client')

type PostResult = Awaited<ReturnType<typeof api.POST>>

const MIGRATION_ID = '00000000-0000-0000-0000-000000000001'
const STALE_ERROR =
  "We couldn't verify the Stripe key right now. Please try again."
const RETRY_ERROR = "We couldn't start the pre-check. Please try again."
const FAILED_FALLBACK = "We couldn't run the pre-check. Please try again."
const migrationKey = ['merchantMigration', { id: MIGRATION_ID }] as const

const failedMigration = {
  id: MIGRATION_ID,
  step: 'source_setup',
  operation: { status: 'failed', stalled: false, error: STALE_ERROR },
} as unknown as schemas['MerchantMigration']

const pendingMigration = {
  id: MIGRATION_ID,
  step: 'source_setup',
  operation: { status: 'pending', stalled: false, error: null },
} as unknown as schemas['MerchantMigration']

function precheckErrorResponse(): PostResult {
  return {
    data: undefined,
    error: { error: 'InternalServerError', detail: 'Internal Server Error' },
    response: new Response(null, { status: 500 }),
  } as unknown as PostResult
}

function precheckSuccessResponse(
  migration: schemas['MerchantMigration'],
): PostResult {
  return {
    data: migration,
    error: undefined,
    response: new Response(),
  } as unknown as PostResult
}

function renderPanel(
  migration: schemas['MerchantMigration'] = failedMigration,
) {
  return render(
    <QueryClientProvider client={queryClientHolder.current!}>
      <PrecheckPanel migration={migration} />
    </QueryClientProvider>,
  )
}

describe('PrecheckPanel', () => {
  beforeEach(() => {
    queryClientHolder.current = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClientHolder.current = null
  })

  it('shows the stale prior-run error when no retry is in flight', () => {
    renderPanel(failedMigration)

    expect(screen.getByText(STALE_ERROR)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeDisabled()
  })

  it('surfaces the retry failure instead of the stale prior-run error', async () => {
    vi.mocked(api.POST).mockResolvedValueOnce(precheckErrorResponse())
    renderPanel(failedMigration)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText(RETRY_ERROR)).toBeInTheDocument()
    expect(screen.queryByText(STALE_ERROR)).not.toBeInTheDocument()
    expect(vi.mocked(api.POST)).toHaveBeenCalledTimes(1)
  })

  it('surfaces the retry failure when there was no prior run', async () => {
    vi.mocked(api.POST).mockResolvedValueOnce(precheckErrorResponse())
    const noPriorRun = {
      ...failedMigration,
      operation: null,
    } as unknown as schemas['MerchantMigration']

    renderPanel(noPriorRun)

    fireEvent.click(screen.getByRole('button', { name: 'Run pre-check' }))

    expect(await screen.findByText(RETRY_ERROR)).toBeInTheDocument()
  })

  it('falls back to a generic message when the prior run failed without one', () => {
    const failedWithoutError = {
      ...failedMigration,
      operation: { status: 'failed', stalled: false, error: null },
    } as unknown as schemas['MerchantMigration']

    renderPanel(failedWithoutError)

    expect(screen.getByText(FAILED_FALLBACK)).toBeInTheDocument()
  })

  it('hides the error and disables the button while the retry POST is running', async () => {
    let resolvePost!: (value: PostResult) => void
    vi.mocked(api.POST).mockReturnValueOnce(
      new Promise<PostResult>((resolve) => {
        resolvePost = resolve
      }),
    )
    renderPanel(failedMigration)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled(),
    )
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.queryByText(STALE_ERROR)).not.toBeInTheDocument()

    resolvePost(precheckErrorResponse())
    expect(await screen.findByText(RETRY_ERROR)).toBeInTheDocument()
  })

  it('clears the retry error after a successful retry', async () => {
    vi.mocked(api.POST).mockResolvedValueOnce(precheckErrorResponse())
    vi.mocked(api.POST).mockResolvedValueOnce(
      precheckSuccessResponse(pendingMigration),
    )
    const { rerender } = renderPanel(failedMigration)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(RETRY_ERROR)).toBeInTheDocument()

    // `onSuccess` writes the pending migration through the shared query
    // client, exactly as production does before the parent re-renders.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(
        queryClientHolder.current!.getQueryData([...migrationKey]),
      ).toEqual(pendingMigration),
    )

    // The prior retry error must not stick across the new mutation cycle.
    rerender(
      <QueryClientProvider client={queryClientHolder.current!}>
        <PrecheckPanel migration={pendingMigration} />
      </QueryClientProvider>,
    )

    expect(screen.queryByText(RETRY_ERROR)).not.toBeInTheDocument()
    expect(screen.queryByText(STALE_ERROR)).not.toBeInTheDocument()
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })
})
