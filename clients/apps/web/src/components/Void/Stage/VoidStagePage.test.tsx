import { server } from '@/test-utils/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyConfiguration } from './diff'
import { VoidStagePage } from './VoidStagePage'

vi.mock('@/components/Layout/DashboardLayout', () => ({
  DashboardBody: ({
    header,
    children,
  }: {
    header: ReactNode
    children: ReactNode
  }) => (
    <>
      {header}
      {children}
    </>
  ),
}))
vi.mock('@/providers/maintainerOrganization', async () => {
  const { createContext } = await import('react')
  return { OrganizationContext: createContext({ organization: { id: 'org' } }) }
})

const active = {
  id: 'active',
  version_id: 'active-version',
  checksum: 'active-version',
  status: 'active',
  applied: true,
  has_configuration: true,
  entries: [],
  created_at: '2026-09-21T12:00:00Z',
}
const draft = {
  ...active,
  id: 'draft',
  version_id: 'draft-version',
  status: 'draft',
  created_at: '2026-09-22T12:00:00Z',
}
const applied = {
  ...emptyConfiguration,
  entitlements: [{ slug: 'support', name: 'Basic support' }],
}
const staged = {
  ...emptyConfiguration,
  entitlements: [{ slug: 'support', name: 'Priority support' }],
}

beforeEach(() => {
  server.use(
    http.get('*/v1/void/stage', () =>
      HttpResponse.json({ revision: 3, configuration: staged }),
    ),
    http.get('*/v1/void/deploys', () => HttpResponse.json([draft, active])),
    http.get('*/v1/void/deploys/active/configuration', () =>
      HttpResponse.json(applied),
    ),
  )
})

it('compares against the active deployment and deploys the reviewed revision as a draft', async () => {
  const requests: unknown[] = []
  server.use(
    http.post('*/v1/void/stage/deploy', async ({ request }) => {
      requests.push({
        body: await request.json(),
        organization: request.headers.get('Polar-Organization-ID'),
      })
      return HttpResponse.json(draft)
    }),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Basic support')).toBeInTheDocument()
  expect(screen.getByText('Priority support')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Deploy as draft' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    'The staged configuration remains saved.',
  )
  expect(requests).toEqual([
    { body: { expected_revision: 3 }, organization: 'org' },
  ])
  expect(screen.getByRole('button', { name: 'Deployed' })).toBeDisabled()
})

it('requires a refreshed review after a revision conflict', async () => {
  server.use(
    http.post('*/v1/void/stage/deploy', () =>
      HttpResponse.json({ detail: 'Stage revision changed.' }, { status: 409 }),
    ),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  await screen.findByText('Priority support')
  fireEvent.click(screen.getByRole('button', { name: 'Deploy as draft' }))
  expect(await screen.findByText('Review the stage again')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deploy as draft' })).toBeDisabled()
  server.use(
    http.get('*/v1/void/stage', () =>
      HttpResponse.json({
        revision: 4,
        configuration: {
          ...staged,
          entitlements: [{ slug: 'support', name: 'Premium support' }],
        },
      }),
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Refresh stage' }))
  expect(await screen.findByText('Premium support')).toBeInTheDocument()
  expect(screen.queryByText('Priority support')).not.toBeInTheDocument()
  await waitFor(() =>
    expect(
      screen.queryByText('Review the stage again'),
    ).not.toBeInTheDocument(),
  )
})

it('shows an empty stage without offering deployment', async () => {
  server.use(
    http.get('*/v1/void/stage', () => new HttpResponse(null, { status: 404 })),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('No staged changes')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deploy as draft' })).toBeDisabled()
})

it('blocks deployment when the applied configuration cannot be loaded', async () => {
  server.use(
    http.get('*/v1/void/deploys/active/configuration', () =>
      HttpResponse.json(
        { detail: 'Configuration unavailable' },
        { status: 500 },
      ),
    ),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  expect(
    await screen.findByText('Could not load the stage'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deploy as draft' })).toBeDisabled()
  expect(screen.queryByText('Priority support')).not.toBeInTheDocument()
})

it('compares the first deployment against an empty configuration', async () => {
  server.use(http.get('*/v1/void/deploys', () => HttpResponse.json([])))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('First deployment')).toBeInTheDocument()
  expect(screen.getByText('1 added')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Deploy as draft' })).toBeEnabled()
})
