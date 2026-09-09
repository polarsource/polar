import { fireEvent, render, screen, within } from '@testing-library/react'
import type { schemas } from '@polar-sh/client'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@polar-sh/orbit', () => ({
  Avatar: ({ name }: { name: string }) => (
    <span data-testid="avatar" data-name={name} aria-hidden="true" />
  ),
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}))

vi.mock('./OrganizationSelector', () => ({
  default: () => <div data-testid="org-selector" />,
}))

vi.mock('./components/CreateOrganizationForm', () => ({
  default: () => null,
}))

vi.mock('@/components/Layout/Public/PolarLogotype', () => ({
  PolarLogotype: () => <span data-testid="logotype" />,
}))

vi.mock('@/components/Image/Image', () => ({
  UploadImage: () => <span data-testid="upload-image" />,
}))

const { default: AuthorizePage } = await import('./AuthorizePage')

const baseAuthorizeResponse = {
  client: {
    client_id: 'acme-client',
    client_name: 'Acme App',
    client_uri: null,
    logo_uri: null,
    tos_uri: null,
    policy_uri: null,
  },
  sub_type: 'user',
  scopes: ['openid', 'user:read'],
  organizations: [
    { id: 'org-1', slug: 'acme', name: 'Acme', avatar_url: null },
  ],
  requires_single_organization: false,
  scope_display_names: {},
} as const

describe('AuthorizePage signed-in account indicator', () => {
  it('renders the signed-in account indicator on both desktop and mobile', () => {
    render(
      <AuthorizePage
        authorizeResponse={
          {
            ...baseAuthorizeResponse,
            sub: {
              id: 'user-1',
              email: 'jade@example.com',
              avatar_url: null,
            },
          } as unknown as schemas['AuthorizeResponseUser']
        }
        searchParams={{}}
      />,
    )

    // The account block lives in `introduction`, which OnboardingLayout
    // renders in both the desktop aside and the mobile main column — so the
    // indicator is visible on mobile too (it was desktop-only when it was a
    // `footer`). One instance per viewport slot.
    expect(screen.getAllByText('Signed in as')).toHaveLength(2)
    expect(screen.getAllByText('jade@example.com')).toHaveLength(2)
    expect(screen.getAllByTestId('avatar')).toHaveLength(2)
    expect(
      screen
        .getAllByTestId('avatar')
        .every((node) => node.getAttribute('data-name') === 'jade@example.com'),
    ).toBe(true)

    // The mobile-visible subtree (<main>) must contain the acting-account cue.
    const main = screen.getByRole('main')
    expect(within(main).getByText('Signed in as')).toBeInTheDocument()
    expect(within(main).getByText('jade@example.com')).toBeInTheDocument()
    expect(within(main).getByTestId('avatar')).toBeInTheDocument()

    // And it remains on desktop too.
    expect(
      within(screen.getByRole('complementary')).getByText('Signed in as'),
    ).toBeInTheDocument()

    // The client introduction also renders on both viewports.
    expect(screen.getAllByText('Acme App')).toHaveLength(2)
  })

  it('omits the account indicator for an anonymous resource owner', () => {
    render(
      <AuthorizePage
        authorizeResponse={
          {
            ...baseAuthorizeResponse,
            sub: null,
          } as unknown as schemas['AuthorizeResponseUser']
        }
        searchParams={{}}
      />,
    )

    expect(screen.queryAllByText('Signed in as')).toHaveLength(0)
    expect(screen.queryAllByText('jade@example.com')).toHaveLength(0)
    expect(screen.queryAllByTestId('avatar')).toHaveLength(0)

    // The client introduction still renders on both desktop and mobile.
    expect(screen.getAllByText('Acme App')).toHaveLength(2)
    expect(
      within(screen.getByRole('main')).getByText('Acme App'),
    ).toBeInTheDocument()
  })

  it('keeps the account indicator visible on every step of the flow', () => {
    render(
      <AuthorizePage
        authorizeResponse={
          {
            ...baseAuthorizeResponse,
            sub: {
              id: 'user-1',
              email: 'jade@example.com',
              avatar_url: null,
            },
          } as unknown as schemas['AuthorizeResponseUser']
        }
        searchParams={{}}
      />,
    )

    // Default step is "organizations".
    expect(screen.getAllByText('Signed in as')).toHaveLength(2)

    // Advance to the scopes step; the introduction (and thus the indicator)
    // persists.
    fireEvent.click(screen.getByRole('button', { name: /review scopes/i }))
    expect(screen.getAllByText('Signed in as')).toHaveLength(2)
    expect(screen.getAllByText('jade@example.com')).toHaveLength(2)
    expect(
      within(screen.getByRole('main')).getByText('OpenID'),
    ).toBeInTheDocument()
  })
})
