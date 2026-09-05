import { vi } from 'vitest'
import type { createMockPolarClient } from './mocks'

type MockPolarClient = ReturnType<typeof createMockPolarClient>

vi.mock('@polar-sh/sdk/2026-04/services/checkouts', () => ({
  createCheckouts: (client: MockPolarClient) => client.checkouts.create,
}))

vi.mock('@polar-sh/sdk/2026-04/services/customer_sessions', () => ({
  createCustomerSessions: (client: MockPolarClient) =>
    client.customerSessions.create,
}))

vi.mock('@polar-sh/sdk/2026-04/services/customers', () => ({
  listCustomers: (client: MockPolarClient) => client.customers.list,
  createCustomers: (client: MockPolarClient) => client.customers.create,
  deleteCustomers: (client: MockPolarClient) => client.customers.delete,
  updateCustomers: (client: MockPolarClient) => client.customers.update,
  getExternalCustomers: (client: MockPolarClient) =>
    client.customers.getExternal,
  updateExternalCustomers: (client: MockPolarClient) =>
    client.customers.updateExternal,
  getStateExternalCustomers: (client: MockPolarClient) =>
    client.customers.getStateExternal,
}))

vi.mock('@polar-sh/sdk/2026-04/services/products', () => ({
  getProducts: (client: MockPolarClient) => client.products.get,
}))

vi.mock('@polar-sh/sdk/2026-04/services/subscriptions', () => ({
  listSubscriptions: (client: MockPolarClient) => client.subscriptions.list,
  getSubscriptions: (client: MockPolarClient) => client.subscriptions.get,
  updateSubscriptions: (client: MockPolarClient) => client.subscriptions.update,
}))

vi.mock('@polar-sh/sdk/2026-04/services/customer_seats', () => ({
  listSeatsCustomerSeats: (client: MockPolarClient) =>
    client.customerSeats.listSeats,
  assignSeatCustomerSeats: (client: MockPolarClient) =>
    client.customerSeats.assignSeat,
  revokeSeatCustomerSeats: (client: MockPolarClient) =>
    client.customerSeats.revokeSeat,
}))

vi.mock('@polar-sh/sdk/2026-04/services/events', () => ({
  ingestEvents: (client: MockPolarClient) => client.events.ingest,
}))

vi.mock('@polar-sh/sdk/2026-04/services/customers/members', () => ({
  listExternalMembers: (client: MockPolarClient) =>
    client.customers.members.listExternal,
  createExternalMembers: (client: MockPolarClient) =>
    client.customers.members.createExternal,
  getExternalMembers: (client: MockPolarClient) =>
    client.customers.members.getExternal,
  deleteExternalMembers: (client: MockPolarClient) =>
    client.customers.members.deleteExternal,
  updateExternalMembers: (client: MockPolarClient) =>
    client.customers.members.updateExternal,
}))

vi.mock(
  '@polar-sh/sdk/2026-04/services/customer_portal/benefit_grants',
  () => ({
    listBenefitGrants: (client: MockPolarClient) =>
      client.customerPortal.benefitGrants.list,
  }),
)

vi.mock('@polar-sh/sdk/2026-04/services/customer_portal/subscriptions', () => ({
  listSubscriptions: (client: MockPolarClient) =>
    client.customerPortal.subscriptions.list,
}))

vi.mock('@polar-sh/sdk/2026-04/services/customer_portal/orders', () => ({
  listOrders: (client: MockPolarClient) => client.customerPortal.orders.list,
}))

vi.mock(
  '@polar-sh/sdk/2026-04/services/customer_portal/customer_meters',
  () => ({
    listCustomerMeters: (client: MockPolarClient) =>
      client.customerPortal.customerMeters.list,
  }),
)
