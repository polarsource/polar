import type { Organization } from 'better-auth/plugins/organization'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errors, type models } from '@polar-sh/sdk/2026-04'
import {
  PolarOrganizationCustomerTypeError,
  ensureTeamCustomer,
  updateTeamCustomer,
} from '../../organization/sync'
import { createMockPolarClient, createMockUser } from '../utils/mocks'

type CustomerIndividual = models.CustomerIndividual
type CustomerTeam = models.CustomerTeam
const { HTTPValidationError, ResourceNotFound } = errors

const organization: Organization = {
  id: 'organization-123',
  name: 'Acme',
  slug: 'acme',
  logo: null,
  createdAt: new Date(),
}

const createTeamCustomer = (
  overrides: Partial<CustomerTeam> = {},
): CustomerTeam => ({
  id: 'customer-123',
  created_at: new Date().toISOString(),
  modified_at: null,
  metadata: {},
  external_id: organization.id,
  email: null,
  email_verified: false,
  type: 'team',
  name: organization.name,
  billing_name: null,
  billing_address: null,
  tax_id: null,
  organization_id: 'polar-organization-123',
  deleted_at: null,
  first_user_event_at: null,
  avatar_url: null,
  ...overrides,
})

const createIndividualCustomer = (): CustomerIndividual => ({
  id: 'customer-123',
  created_at: new Date().toISOString(),
  modified_at: null,
  metadata: {},
  external_id: organization.id,
  email: 'owner@example.com',
  email_verified: false,
  type: 'individual',
  name: 'Owner',
  billing_name: null,
  billing_address: null,
  tax_id: null,
  organization_id: 'polar-organization-123',
  deleted_at: null,
  first_user_event_at: null,
  avatar_url: null,
})

const notFound = () =>
  new ResourceNotFound(404, {
    error: 'ResourceNotFound',
    detail: 'Customer not found',
  })

const validationError = (
  {
    type = 'value_error',
    loc = ['body', 'external_id'],
    input = organization.id,
    msg = 'Duplicate external identifier.',
  }: {
    type?: string
    loc?: Array<string | number>
    input?: unknown
    msg?: string
  } = {},
  status = 422,
) =>
  new HTTPValidationError(status as 422, {
    detail: [{ loc, msg, type, input }],
  })

describe('organization customer synchronization', () => {
  const owner = createMockUser({
    id: 'user-123',
    email: 'owner@example.com',
    name: 'Owner',
  })
  let client: ReturnType<typeof createMockPolarClient>

  beforeEach(() => {
    client = createMockPolarClient()
    vi.clearAllMocks()
  })

  it('creates a missing team customer with an explicit owner', async () => {
    vi.mocked(client.customers.getExternal).mockRejectedValue(notFound())
    vi.mocked(client.customers.create).mockResolvedValue(createTeamCustomer())

    await ensureTeamCustomer(
      client,
      { enabled: true },
      {
        organization,
        owner,
      },
    )

    expect(client.customers.create).toHaveBeenCalledWith({
      type: 'team',
      external_id: organization.id,
      name: organization.name,
      owner: {
        external_id: owner.id,
        email: owner.email,
        name: owner.name,
      },
    })
  })

  it('returns an existing team customer without updating it', async () => {
    vi.mocked(client.customers.getExternal).mockResolvedValue(
      createTeamCustomer({ name: 'Existing Polar name' }),
    )

    await ensureTeamCustomer(
      client,
      { enabled: true },
      {
        organization,
        owner,
      },
    )

    expect(client.customers.create).not.toHaveBeenCalled()
    expect(client.customers.updateExternal).not.toHaveBeenCalled()
  })

  it('does not allow custom parameters to override identity fields', async () => {
    vi.mocked(client.customers.getExternal).mockRejectedValue(notFound())
    vi.mocked(client.customers.create).mockResolvedValue(createTeamCustomer())
    const getTeamCustomerCreateParams = vi.fn().mockResolvedValue({
      type: 'individual',
      external_id: 'other-organization',
      name: 'Other name',
      owner: {
        external_id: 'other-user',
        email: 'other@example.com',
      },
      metadata: { source: 'better-auth' },
    })

    await ensureTeamCustomer(
      client,
      { enabled: true, getTeamCustomerCreateParams },
      { organization, owner },
    )

    expect(client.customers.create).toHaveBeenCalledWith({
      type: 'team',
      external_id: organization.id,
      name: organization.name,
      owner: {
        external_id: owner.id,
        email: owner.email,
        name: owner.name,
      },
      metadata: { source: 'better-auth' },
    })
  })

  it('refetches after an external ID creation race', async () => {
    vi.mocked(client.customers.getExternal)
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(createTeamCustomer())
    vi.mocked(client.customers.create).mockRejectedValue(validationError())

    await ensureTeamCustomer(
      client,
      { enabled: true },
      {
        organization,
        owner,
      },
    )

    expect(client.customers.getExternal).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['validation type', { type: 'string_type' }],
    ['validation location', { loc: ['body', 'email'] }],
    ['validation input', { input: 'another-organization' }],
  ])('does not recover from a mismatched external ID %s', async (_, detail) => {
    const error = validationError(detail)
    vi.mocked(client.customers.getExternal).mockRejectedValue(notFound())
    vi.mocked(client.customers.create).mockRejectedValue(error)

    await expect(
      ensureTeamCustomer(client, { enabled: true }, { organization, owner }),
    ).rejects.toBe(error)
    expect(client.customers.getExternal).toHaveBeenCalledOnce()
  })

  it('rethrows a matching external ID error when no raced customer exists', async () => {
    const error = validationError()
    vi.mocked(client.customers.getExternal).mockRejectedValue(notFound())
    vi.mocked(client.customers.create).mockRejectedValue(error)

    await expect(
      ensureTeamCustomer(client, { enabled: true }, { organization, owner }),
    ).rejects.toBe(error)
    expect(client.customers.getExternal).toHaveBeenCalledTimes(2)
  })

  it('rejects an individual customer using the organization external ID', async () => {
    vi.mocked(client.customers.getExternal).mockResolvedValue(
      createIndividualCustomer(),
    )

    await expect(
      ensureTeamCustomer(
        client,
        { enabled: true },
        {
          organization,
          owner,
        },
      ),
    ).rejects.toBeInstanceOf(PolarOrganizationCustomerTypeError)
  })

  it('does not treat network and unrelated validation errors as absence', async () => {
    const networkError = new Error('Network unavailable')
    vi.mocked(client.customers.getExternal).mockRejectedValue(networkError)

    await expect(
      ensureTeamCustomer(
        client,
        { enabled: true },
        {
          organization,
          owner,
        },
      ),
    ).rejects.toBe(networkError)
    expect(client.customers.create).not.toHaveBeenCalled()
  })

  it('updates an organization customer by external ID', async () => {
    vi.mocked(client.customers.updateExternal).mockResolvedValue(
      createTeamCustomer({ name: 'New name' }),
    )

    await updateTeamCustomer(client, {
      ...organization,
      name: 'New name',
    })

    expect(client.customers.updateExternal).toHaveBeenCalledWith(
      organization.id,
      { name: 'New name' },
    )
  })
})
