import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { webhooks } from '../../plugins/webhooks'
import { createMockPolarClient } from '../utils/mocks'

vi.mock('@polar-sh/adapter-utils', () => ({
  handleWebhookPayload: vi.fn(),
}))

vi.mock('@polar-sh/sdk/2026-04', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@polar-sh/sdk/2026-04')>()
  class PolarWebhookError extends Error {}
  class PolarWebhookVerificationError extends PolarWebhookError {}
  class PolarWebhookUnknownTypeError extends PolarWebhookError {
    constructor(public readonly eventType: string | null) {
      super(`Unknown webhook event type: ${JSON.stringify(eventType)}`)
    }
  }

  return {
    ...original,
    webhooks: {
      validateEvent: vi.fn(),
      PolarWebhookError,
      PolarWebhookVerificationError,
      PolarWebhookUnknownTypeError,
    },
  }
})

vi.mock('better-auth/api', () => ({
  APIError: class APIError extends Error {
    constructor(
      public code: string,
      public data?: { message: string },
    ) {
      super(data?.message || code)
    }
  },
  createAuthEndpoint: vi.fn((path, config, handler) => ({
    path,
    config,
    handler,
  })),
}))

vi.mock('../../organization/seats', () => ({
  MANAGED_SUBSCRIPTION_STATUSES: new Set(['active', 'trialing', 'past_due']),
  getBetterAuthOrganizationOptions: vi.fn(),
  getOrganizationRoster: vi.fn(),
  synchronizeOrganizationSeats: vi.fn(),
}))

vi.mock('../../organization/sync', () => ({
  ensureMemberMirror: vi.fn(),
}))

const { handleWebhookPayload } = (await vi.importMock(
  '@polar-sh/adapter-utils',
)) as any
import { webhooks as sdkWebhooks } from '@polar-sh/sdk/2026-04'
const validateEvent = sdkWebhooks.validateEvent as Mock
const {
  getBetterAuthOrganizationOptions,
  getOrganizationRoster,
  synchronizeOrganizationSeats,
} = (await vi.importMock('../../organization/seats')) as any
const { ensureMemberMirror } = (await vi.importMock(
  '../../organization/sync',
)) as any

const teamSubscriptionEvent = {
  type: 'subscription.created',
  data: {
    id: 'sub-123',
    customer: { type: 'team' as const, external_id: 'org-abc' },
    seats: 5,
    status: 'active' as const,
  },
}

const matchingSubscription = {
  customer: { type: 'team' as const, external_id: 'org-abc' },
  seats: 5,
  status: 'active' as const,
}

const roster = [
  {
    role: 'owner',
    user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
  },
  {
    role: 'admin',
    user: { id: 'user-2', email: 'admin@example.com', name: 'Admin' },
  },
]

describe('webhooks plugin — seats-sync decoupling', () => {
  let mockClient: ReturnType<typeof createMockPolarClient>
  let mockRequest: Request
  let findOne: Mock

  const buildHandler = (syncSeats: boolean) => {
    const options = {
      secret: 'test-webhook-secret',
      onSubscriptionCreated: vi.fn(),
      onSubscriptionActive: vi.fn(),
    }
    const rootOptions = {
      experimental_organizationSync: {
        enabled: true,
        syncSeats,
      },
    }
    const plugin = webhooks(options)
    const endpoints = plugin(mockClient, rootOptions as any) as any
    return endpoints.polarWebhooks.handler
  }

  const buildCtx = (overrides: Record<string, any> = {}) => ({
    request: mockRequest,
    context: {
      logger: { error: vi.fn() },
      adapter: { findOne },
    },
    json: vi.fn().mockReturnValue({ received: true }),
    ...overrides,
  })

  beforeEach(() => {
    mockClient = createMockPolarClient()
    vi.clearAllMocks()

    const headers = new Headers({
      'webhook-id': 'wh_123',
      'webhook-timestamp': '1234567890',
      'webhook-signature': 'v1,signature123',
    })
    mockRequest = {
      headers,
      text: vi
        .fn()
        .mockResolvedValue('{"type": "subscription.created", "data": {}}'),
      body: '{"type": "subscription.created", "data": {}}',
    } as any

    findOne = vi.fn().mockResolvedValue({ id: 'org-abc', name: 'Acme' })
    vi.mocked(validateEvent).mockReturnValue(teamSubscriptionEvent)
    vi.mocked(handleWebhookPayload).mockResolvedValue(undefined)
    mockClient.subscriptions.get.mockResolvedValue(matchingSubscription)
    vi.mocked(getBetterAuthOrganizationOptions).mockReturnValue({
      creatorRole: 'owner',
    })
    vi.mocked(getOrganizationRoster).mockResolvedValue(roster)
    vi.mocked(ensureMemberMirror).mockResolvedValue(undefined)
    vi.mocked(synchronizeOrganizationSeats).mockResolvedValue(undefined)
  })

  it('dispatches to handleWebhookPayload even when the seats-sync block throws', async () => {
    // The core regression: a seat-sync failure must not suppress user handlers.
    vi.mocked(ensureMemberMirror).mockRejectedValue(
      new Error('role mapping blew up'),
    )

    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).rejects.toThrow(
      'Webhook error: See server logs for more information.',
    )

    // The public webhook contract still ran — this is the fix.
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
    expect(handleWebhookPayload).toHaveBeenCalledWith(
      teamSubscriptionEvent,
      expect.objectContaining({ webhookSecret: 'test-webhook-secret' }),
    )
    // The rethrow preserves Polar's retry trigger for seat-sync failures.
    expect(ctx.json).not.toHaveBeenCalled()
    // The seat-sync failure is logged distinctly from webhook dispatch failures.
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      'Polar organization seat sync failed. Error: role mapping blew up',
    )
    // The webhook-dispatch failure path was NOT logged (dispatch succeeded).
    expect(ctx.context.logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Polar webhook failed'),
    )
  })

  it('control: dispatches to handleWebhookPayload and returns 200 when syncSeats is disabled', async () => {
    const handler = buildHandler(false)
    const ctx = buildCtx()

    await expect(handler(ctx)).resolves.toEqual({ received: true })

    // The seats block is skipped entirely.
    expect(findOne).not.toHaveBeenCalled()
    expect(getBetterAuthOrganizationOptions).not.toHaveBeenCalled()
    expect(ensureMemberMirror).not.toHaveBeenCalled()
    expect(synchronizeOrganizationSeats).not.toHaveBeenCalled()
    // The public handler runs unconditionally.
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
    expect(ctx.json).toHaveBeenCalledWith({ received: true })
  })

  it('control: dispatches to handleWebhookPayload and returns 200 when the seats block succeeds', async () => {
    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).resolves.toEqual({ received: true })

    // The seats block ran to completion.
    expect(findOne).toHaveBeenCalledTimes(1)
    expect(mockClient.subscriptions.get).toHaveBeenCalledTimes(1)
    expect(mockClient.subscriptions.get).toHaveBeenCalledWith('sub-123')
    expect(getBetterAuthOrganizationOptions).toHaveBeenCalledTimes(1)
    expect(getOrganizationRoster).toHaveBeenCalledTimes(1)
    expect(ensureMemberMirror).toHaveBeenCalledTimes(roster.length)
    expect(synchronizeOrganizationSeats).toHaveBeenCalledTimes(1)
    // And the public handler still ran.
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
    expect(ctx.json).toHaveBeenCalledWith({ received: true })
  })

  it('a synchronizeOrganizationSeats failure still dispatches to user handlers and rethrows', async () => {
    vi.mocked(synchronizeOrganizationSeats).mockRejectedValue(
      new Error('SDK listSeats 5xx'),
    )

    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).rejects.toThrow(
      'Webhook error: See server logs for more information.',
    )

    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      'Polar organization seat sync failed. Error: SDK listSeats 5xx',
    )
  })

  it('a non-Error seats-sync throw is logged and still dispatches to user handlers', async () => {
    vi.mocked(ensureMemberMirror).mockRejectedValue('a string was thrown')

    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).rejects.toThrow(
      'Webhook error: See server logs for more information.',
    )

    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      'Polar organization seat sync failed. Error: a string was thrown',
    )
  })

  it('surfaces the webhook-dispatch error when both seats-sync and handleWebhookPayload fail', async () => {
    vi.mocked(ensureMemberMirror).mockRejectedValue(
      new Error('seat-sync failed'),
    )
    vi.mocked(handleWebhookPayload).mockRejectedValue(
      new Error('user handler failed'),
    )

    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).rejects.toThrow(
      'Webhook error: See server logs for more information.',
    )

    // Both ran; the dispatch error is the surfaced one (its catch throws first).
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      'Polar organization seat sync failed. Error: seat-sync failed',
    )
    expect(ctx.context.logger.error).toHaveBeenCalledWith(
      'Polar webhook failed. Error: user handler failed',
    )
  })

  it('does not run the seats block for non-subscription events even with syncSeats enabled', async () => {
    vi.mocked(validateEvent).mockReturnValue({
      type: 'checkout.created',
      data: { id: 'checkout-1' },
    })

    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).resolves.toEqual({ received: true })

    expect(findOne).not.toHaveBeenCalled()
    expect(ensureMemberMirror).not.toHaveBeenCalled()
    expect(synchronizeOrganizationSeats).not.toHaveBeenCalled()
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
  })

  it('does not run the seats block for individual (non-team) customers', async () => {
    vi.mocked(validateEvent).mockReturnValue({
      type: 'subscription.created',
      data: {
        id: 'sub-123',
        customer: { type: 'individual', external_id: 'cust-abc' },
        seats: 5,
        status: 'active',
      },
    })

    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).resolves.toEqual({ received: true })

    expect(findOne).not.toHaveBeenCalled()
    expect(ensureMemberMirror).not.toHaveBeenCalled()
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
  })

  it('does not run seat-sync internals when the organization is not found', async () => {
    findOne.mockResolvedValue(null)

    const handler = buildHandler(true)
    const ctx = buildCtx()

    await expect(handler(ctx)).resolves.toEqual({ received: true })

    expect(findOne).toHaveBeenCalledTimes(1)
    expect(getOrganizationRoster).not.toHaveBeenCalled()
    expect(ensureMemberMirror).not.toHaveBeenCalled()
    expect(synchronizeOrganizationSeats).not.toHaveBeenCalled()
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
  })

  it('does not run the seats block when experimental_organizationSync is disabled', async () => {
    const options = {
      secret: 'test-webhook-secret',
      onSubscriptionCreated: vi.fn(),
    }
    const rootOptions = {
      experimental_organizationSync: { enabled: false, syncSeats: true },
    }
    const plugin = webhooks(options)
    const endpoints = plugin(mockClient, rootOptions as any) as any
    const handler = endpoints.polarWebhooks.handler
    const ctx = buildCtx()

    await expect(handler(ctx)).resolves.toEqual({ received: true })

    expect(findOne).not.toHaveBeenCalled()
    expect(ensureMemberMirror).not.toHaveBeenCalled()
    expect(handleWebhookPayload).toHaveBeenCalledTimes(1)
  })

  it('passes the user event handlers through to handleWebhookPayload alongside seat-sync', async () => {
    const onSubscriptionCreated = vi.fn()
    const onPayload = vi.fn()
    const options = {
      secret: 'test-webhook-secret',
      onSubscriptionCreated,
      onPayload,
    }
    const rootOptions = {
      experimental_organizationSync: { enabled: true, syncSeats: true },
    }
    const plugin = webhooks(options)
    const endpoints = plugin(mockClient, rootOptions as any) as any
    const handler = endpoints.polarWebhooks.handler
    const ctx = buildCtx()

    await expect(handler(ctx)).resolves.toEqual({ received: true })

    expect(handleWebhookPayload).toHaveBeenCalledWith(
      teamSubscriptionEvent,
      expect.objectContaining({
        webhookSecret: 'test-webhook-secret',
        onSubscriptionCreated,
        onPayload,
      }),
    )
  })
})
