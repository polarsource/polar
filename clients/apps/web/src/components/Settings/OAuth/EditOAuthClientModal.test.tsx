import { cleanup, render } from '@testing-library/react'
import { schemas } from '@polar-sh/client'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/Modal/ConfirmModal', () => ({
  ConfirmModal: () => null,
}))

vi.mock('@polar-sh/orbit', () => ({
  InlineModalHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
  }: PropsWithChildren & { onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('@/components/Modal/useModal', () => ({
  useModal: () => ({
    hide: vi.fn(),
    isShown: false,
    show: vi.fn(),
  }),
}))

vi.mock('@/components/Toast/use-toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@/hooks/queries/oauth', () => ({
  useDeleteOAuthClient: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateOAuth2Client: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/utils/api/errors', () => ({
  extractApiErrorMessage: vi.fn(() => 'error'),
}))

vi.mock('@polar-sh/ui/components/atoms/ShadowBox', () => ({
  ShadowBoxOnMd: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))

vi.mock('@polar-sh/ui/components/ui/form', () => ({
  Form: ({ children }: PropsWithChildren) => children,
}))

vi.mock('./OAuthForm', () => ({
  FieldName: () => null,
  FieldClientID: () => null,
  FieldClientSecret: ({ clientSecret }: { clientSecret: string }) => (
    <div data-testid="field-client-secret" data-value={clientSecret}>
      Client Secret
    </div>
  ),
  FieldClientType: () => null,
  FieldRedirectURIs: () => null,
  FieldScopes: () => null,
  FieldClientURI: () => null,
  FieldTOS: () => null,
  FieldPrivacy: () => null,
}))

import { EditOAuthClientModal } from './EditOAuthClientModal'

const createClient = (
  overrides: Partial<schemas['OAuth2Client']> = {},
): schemas['OAuth2Client'] =>
  ({
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    client_name: 'Test Client',
    token_endpoint_auth_method: 'client_secret_post',
    redirect_uris: ['https://example.com/callback'],
    scope: 'openid profile email',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    client_uri: 'https://example.com',
    logo_uri: null,
    tos_uri: null,
    policy_uri: null,
    default_sub_type: 'user',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: null,
    client_id_issued_at: 0,
    client_secret_expires_at: 0,
    ...overrides,
  }) as schemas['OAuth2Client']

const renderModal = (client: schemas['OAuth2Client']) =>
  render(
    <EditOAuthClientModal
      client={client}
      onSuccess={vi.fn()}
      onDelete={vi.fn()}
      onHide={vi.fn()}
    />,
  )

describe('EditOAuthClientModal', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('FieldClientSecret rendering', () => {
    it('renders the Client Secret field for confidential clients', () => {
      const { getByTestId } = renderModal(createClient())

      const field = getByTestId('field-client-secret')
      expect(field.getAttribute('data-value')).toBe('test-client-secret')
    })

    it('does not render the Client Secret field for public clients (token_endpoint_auth_method=none)', () => {
      // Backend omits client_secret for public clients — simulate the runtime
      // shape: token_endpoint_auth_method is 'none' and client_secret is undefined.
      const publicClient = createClient({
        token_endpoint_auth_method: 'none',
        client_secret: undefined,
      })

      const { queryByTestId } = renderModal(publicClient)

      expect(queryByTestId('field-client-secret')).toBeNull()
    })

    it('does not render the Client Secret field when client_secret is missing even for non-public clients', () => {
      const clientWithMissingSecret = createClient({
        client_secret: undefined,
      })

      const { queryByTestId } = renderModal(clientWithMissingSecret)

      expect(queryByTestId('field-client-secret')).toBeNull()
    })

    it('does not render the Client Secret field for public clients even if client_secret is present', () => {
      const publicClientWithSecret = createClient({
        token_endpoint_auth_method: 'none',
        client_secret: 'should-not-show',
      })

      const { queryByTestId } = renderModal(publicClientWithSecret)

      expect(queryByTestId('field-client-secret')).toBeNull()
    })
  })
})
