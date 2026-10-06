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
    contextView,
    children,
  }: {
    header: ReactNode
    contextView?: ReactNode
    children: ReactNode
  }) => (
    <>
      {header}
      {contextView}
      {children}
    </>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
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
    http.get('*/v1/void/customers', () => HttpResponse.json([])),
    http.get('*/v1/void/subscriptions', () => HttpResponse.json([])),
    http.get('*/v1/void/reducers', () => HttpResponse.json([])),
  )
})

it.each([false, true])(
  'deploys the reviewed revision with activate=%s and clears the stage',
  async (activate) => {
    const requests: unknown[] = []
    let cleared = false
    const result = { ...draft, status: activate ? 'active' : 'draft' }
    server.use(
      http.get('*/v1/void/stage', () =>
        cleared
          ? new HttpResponse(null, { status: 404 })
          : HttpResponse.json({ revision: 3, configuration: staged }),
      ),
      http.get('*/v1/void/deploys', () =>
        HttpResponse.json(
          cleared && activate
            ? [result, { ...active, status: 'archived' }]
            : [draft, active],
        ),
      ),
      http.get('*/v1/void/deploys/draft/configuration', () =>
        HttpResponse.json(staged),
      ),
      http.post('*/v1/void/stage/deploy', async ({ request }) => {
        requests.push({
          body: await request.json(),
          organization: request.headers.get('Polar-Organization-ID'),
        })
        cleared = true
        return HttpResponse.json(result)
      }),
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <VoidStagePage />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Basic support')).toBeInTheDocument()
    expect(screen.getByText('Priority support')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: activate ? 'Deploy and activate' : 'Deploy as draft',
      }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'The deployed stage was cleared.',
    )
    expect(requests).toEqual([
      { body: { expected_revision: 3, activate }, organization: 'org' },
    ])
    expect(await screen.findByText('No staged changes')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Deploy and activate' }),
    ).toBeDisabled()
    expect(screen.queryByText('Priority support')).not.toBeInTheDocument()
  },
)

it('keeps the stage visible when activation fails', async () => {
  server.use(
    http.post('*/v1/void/stage/deploy', () =>
      HttpResponse.json(
        { detail: 'Organization must pass review.' },
        { status: 403 },
      ),
    ),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  await screen.findByText('Priority support')
  fireEvent.click(screen.getByRole('button', { name: 'Deploy and activate' }))
  expect(
    await screen.findByText('Organization must pass review.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Priority support')).toBeInTheDocument()
  expect(screen.queryByText('No staged changes')).not.toBeInTheDocument()
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

it('folds the staged JSON by default and simulates the stage', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  await screen.findByText('Priority support')
  expect(screen.queryByText(/"Priority support"/)).not.toBeInTheDocument()
  const toggle = screen.getByRole('button', { name: /Staged JSON/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(toggle)
  expect(screen.getByText(/"Priority support"/)).toBeInTheDocument()
  fireEvent.click(toggle)
  expect(screen.queryByText(/"Priority support"/)).not.toBeInTheDocument()
  expect(
    await screen.findByRole('heading', { name: 'Projection' }),
  ).toBeInTheDocument()
})

it('saves lever edits to the stage and blocks deploying unsaved edits', async () => {
  const pro = {
    slug: 'pro',
    name: 'Pro',
    description: null,
    price: { type: 'recurring', amount: '20', interval: 'month' },
    meters: [],
    entitlements: [],
  }
  const configuration = { ...staged, products: [pro] }
  const saves: unknown[] = []
  server.use(
    http.get('*/v1/void/stage', () =>
      HttpResponse.json({ revision: 3, configuration }),
    ),
    http.put('*/v1/void/stage', async ({ request }) => {
      const body = (await request.json()) as {
        configuration: typeof configuration
      }
      saves.push(body)
      return HttpResponse.json({
        revision: 4,
        configuration: body.configuration,
      })
    }),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidStagePage />
    </QueryClientProvider>,
  )
  const price = await screen.findByDisplayValue('20')
  fireEvent.focus(price)
  fireEvent.change(price, { target: { value: '' } })
  expect(price).toHaveValue(null)
  fireEvent.change(price, { target: { value: '25' } })
  fireEvent.blur(price)
  expect(
    screen.getByRole('button', { name: 'Deploy and activate' }),
  ).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Save to stage' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Save to stage' }),
    ).not.toBeInTheDocument(),
  )
  expect(saves).toEqual([
    {
      expected_revision: 3,
      configuration: {
        ...configuration,
        products: [{ ...pro, price: { ...pro.price, amount: '25' } }],
      },
    },
  ])
  expect(screen.getByDisplayValue('25')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Deploy and activate' }),
  ).toBeEnabled()
})
