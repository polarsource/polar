import { server } from '@/test-utils/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, it, vi } from 'vitest'
import { DefinitionEditor } from './DefinitionEditor'
import { emptyConfiguration } from './diff'
import { stageKey, type Stage } from './queries'

vi.mock('../dataSource', () => ({ useVoidDataSource: () => 'live' }))
vi.mock('@/providers/maintainerOrganization', async () => {
  const { createContext } = await import('react')
  return {
    OrganizationContext: createContext({
      organization: { id: 'org', slug: 'org' },
    }),
  }
})

const configuration = {
  ...emptyConfiguration,
  products: [
    {
      slug: 'pro',
      name: 'Pro',
      description: 'Existing description',
      price: {
        type: 'recurring',
        amount: '20',
        currency: 'usd',
        interval: 'month',
        interval_count: 1,
      },
      meters: [
        { slug: 'tokens', included: 100, limit: 'hard', rollover_cap: 0 },
      ],
      entitlements: ['support'],
    },
  ],
  meters: [
    {
      slug: 'tokens',
      reducer: 'usage',
      credit_reducer: null,
      unit_amount: '0.01',
      currency: 'usd',
    },
  ],
  entitlements: [{ slug: 'support', name: 'Support' }],
  activities: [{ slug: 'generate', name: 'Generate' }],
  signals: [
    {
      slug: 'low-balance',
      meter: 'tokens',
      kind: 'meter',
      enter_below: 10,
      exit_at_least: 20,
    },
  ],
  reducers: [{ slug: 'usage', type: 'sum' }],
}
let stage: Stage | null
let writes: {
  expected_revision: number | null
  configuration: Stage['configuration']
}[]

beforeEach(() => {
  stage = { revision: 4, configuration: structuredClone(configuration) }
  writes = []
  server.use(
    http.get('*/v1/void/stage', () =>
      stage
        ? HttpResponse.json(stage)
        : new HttpResponse(null, { status: 404 }),
    ),
    http.get('*/v1/void/deploys', () =>
      HttpResponse.json([
        { id: 'active', status: 'active', has_configuration: true },
      ]),
    ),
    http.get('*/v1/void/deploys/active/configuration', () =>
      HttpResponse.json(configuration),
    ),
    http.put('*/v1/void/stage', async ({ request }) => {
      const body = (await request.json()) as (typeof writes)[number]
      writes.push(body)
      if (body.expected_revision !== (stage?.revision ?? null))
        return HttpResponse.json({ detail: 'Stage changed' }, { status: 409 })
      stage = {
        revision: (stage?.revision ?? 0) + 1,
        configuration: body.configuration,
      }
      return HttpResponse.json(stage)
    }),
  )
})

it('stages successive product and meter edits while preserving the remaining configuration', async () => {
  stage!.configuration.products[0].name = 'Staged Pro'
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <DefinitionEditor kind="products" slug="pro" />
      <DefinitionEditor kind="meters" slug="tokens" />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Edit product' }))
  expect(await screen.findByLabelText('Name')).toHaveValue('Staged Pro')
  expect(
    screen.getByText('Editing staged configuration · Revision 4'),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Price'), {
    target: { value: '25.50' },
  })
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save to stage' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Saved to stage')
  expect(screen.getByRole('link', { name: /Review staged/ })).toHaveAttribute(
    'href',
    '/void/dashboard/org/definition/stage',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Edit meter' }))
  fireEvent.change(await screen.findByLabelText('Unit price'), {
    target: { value: '0.123456789012' },
  })
  fireEvent.change(screen.getByLabelText('Usage reducer'), {
    target: { value: 'new-usage' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save to stage' }))
  await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2))
  expect(writes.map((write) => write.expected_revision)).toEqual([4, 5])
  expect(stage!.configuration).toEqual({
    ...configuration,
    products: [
      {
        ...configuration.products[0],
        name: 'Staged Pro',
        description: null,
        price: { ...configuration.products[0].price, amount: '25.50' },
      },
    ],
    meters: [
      {
        ...configuration.meters[0],
        unit_amount: '0.123456789012',
        reducer: 'new-usage',
      },
    ],
  })
  expect(client.getQueryData(stageKey('org'))).toEqual(stage)
})

it('creates a stage from the complete active configuration and supports cancel', async () => {
  stage = null
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DefinitionEditor kind="products" slug="pro" />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Edit product' }))
  fireEvent.change(await screen.findByLabelText('Name'), {
    target: { value: 'Unsaved' },
  })
  expect(screen.getByText('Editing active configuration')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(writes).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Edit product' }))
  expect(await screen.findByLabelText('Name')).toHaveValue('Pro')
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'New Pro' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save to stage' }))
  await screen.findByRole('status')
  expect(writes).toEqual([
    {
      expected_revision: null,
      configuration: {
        ...configuration,
        products: [{ ...configuration.products[0], name: 'New Pro' }],
      },
    },
  ])
})

it('keeps the original revision when background data changes and rejects stale edits', async () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <DefinitionEditor kind="meters" slug="tokens" />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Edit meter' }))
  fireEvent.change(await screen.findByLabelText('Unit price'), {
    target: { value: '2' },
  })
  stage = {
    revision: 5,
    configuration: {
      ...configuration,
      meters: [{ ...configuration.meters[0], unit_amount: '3' }],
    },
  }
  client.setQueryData(stageKey('org'), stage)
  fireEvent.click(screen.getByRole('button', { name: 'Save to stage' }))
  expect(await screen.findByText('The stage has changed')).toBeInTheDocument()
  expect(writes[0].expected_revision).toBe(4)
  expect(stage.configuration.meters[0].unit_amount).toBe('3')
  expect(screen.getByRole('button', { name: 'Save to stage' })).toBeDisabled()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit meter' }))
  expect(await screen.findByLabelText('Unit price')).toHaveValue(3)
})

it('does not reconstruct a definition that has been removed from the stage', async () => {
  stage!.configuration.meters = []
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DefinitionEditor kind="meters" slug="tokens" />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Edit meter' }))
  expect(
    await screen.findByText(
      'This definition is not in the staged configuration.',
    ),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Save to stage' }),
  ).not.toBeInTheDocument()
  expect(writes).toHaveLength(0)
})
