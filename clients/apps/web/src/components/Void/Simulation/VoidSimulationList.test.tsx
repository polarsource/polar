import { server } from '@/test-utils/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { emptyConfiguration } from '../Stage/diff'
import { VoidSimulationList } from './VoidSimulationList'

vi.mock('@/components/Layout/DashboardLayout', () => ({
  DashboardBody: ({
    header,
    children,
  }: {
    header?: ReactNode
    children: ReactNode
  }) => (
    <>
      {header}
      {children}
    </>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/providers/maintainerOrganization', async () => {
  const { createContext } = await import('react')
  return {
    OrganizationContext: createContext({
      organization: { id: 'org', slug: 'acme' },
    }),
  }
})

beforeEach(() => {
  server.use(
    http.get('*/v1/void/scenarios', () => HttpResponse.json([])),
    http.get('*/v1/void/deploys', () => HttpResponse.json([])),
    http.get('*/v1/void/customers', () => HttpResponse.json([])),
    http.get('*/v1/void/subscriptions', () => HttpResponse.json([])),
    http.get('*/v1/void/reducers', () => HttpResponse.json([])),
  )
})

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VoidSimulationList />
    </QueryClientProvider>,
  )

it('shows the staged configuration as the current draft', async () => {
  server.use(
    http.get('*/v1/void/stage', () =>
      HttpResponse.json({ revision: 7, configuration: emptyConfiguration }),
    ),
  )
  renderList()
  expect(await screen.findByText('Current draft')).toBeInTheDocument()
  expect(screen.getByText('Revision 7')).toBeInTheDocument()
  expect(screen.getByText('Staged')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Current draft/ })).toHaveAttribute(
    'href',
    '/void/dashboard/acme/simulate/stage',
  )
})

it('hides the current draft when nothing is staged', async () => {
  server.use(
    http.get('*/v1/void/stage', () => new HttpResponse(null, { status: 404 })),
  )
  renderList()
  await screen.findByRole('button', { name: 'New scenario' })
  expect(screen.queryByText('Current draft')).not.toBeInTheDocument()
})
