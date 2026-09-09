import { render, screen, within } from '@testing-library/react'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks', () => ({
  useAuth: () => ({ userOrganizations: [] }),
  useLogout: () => vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({ children }: { children?: ReactNode }) => <Box>{children}</Box>,
  Text: ({ children }: { children?: ReactNode }) => <Box>{children}</Box>,
}))

vi.mock('./OnboardingStepper', () => ({
  ONBOARDING_STEPS: [
    { id: 'personal', title: 'Personal', route: '/onboarding/personal' },
    { id: 'business', title: 'Business', route: '/onboarding/business' },
  ],
}))

vi.mock('../Layout/Public/PolarLogotype', () => ({
  PolarLogotype: () => <Box data-testid="logotype" />,
}))

const { OnboardingShell } = await import('./OnboardingShell')

describe('OnboardingShell', () => {
  it('renders the footer links in the desktop aside and the mobile main column', () => {
    render(
      <OnboardingShell title="Personal details" step="personal">
        <Box data-testid="content">step content</Box>
      </OnboardingShell>,
    )

    // OnboardingShell feeds both `footer` (desktop aside) and `mobileFooter`
    // (mobile main). Both must render the shared footer links — regression
    // guard confirming the unchanged OnboardingLayout contract still serves
    // the onboarding flow on both viewports. (hadOrgs is false here, so the
    // "Back to dashboard" link is omitted — assert the always-present links.)
    expect(screen.getAllByText('User settings')).toHaveLength(2)
    expect(screen.getAllByText('Log out')).toHaveLength(2)

    expect(
      within(screen.getByRole('complementary')).getByText('Log out'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByText('Log out'),
    ).toBeInTheDocument()

    expect(screen.getByTestId('content')).toBeInTheDocument()
  })
})
