import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const { OnboardingLayout } = await import('./OnboardingLayout')

describe('OnboardingLayout', () => {
  it('renders introduction in both the desktop aside and the mobile main column', () => {
    render(
      <OnboardingLayout
        branding={<span data-testid="branding" />}
        introduction={<span data-testid="introduction">Intro</span>}
      />,
    )

    // introduction is the all-viewport slot: it must render in the desktop
    // aside AND the mobile-only main column so content is never desktop-only.
    expect(screen.getAllByTestId('introduction')).toHaveLength(2)
    expect(
      within(screen.getByRole('complementary')).getByTestId('introduction'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByTestId('introduction'),
    ).toBeInTheDocument()
  })

  it('renders the desktop footer only inside the aside (hidden below the lg breakpoint)', () => {
    render(
      <OnboardingLayout
        branding={<span />}
        introduction={<span>Intro</span>}
        footer={<span data-testid="footer">Desktop footer</span>}
      />,
    )

    expect(screen.getAllByTestId('footer')).toHaveLength(1)
    expect(
      within(screen.getByRole('complementary')).getByTestId('footer'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).queryByTestId('footer'),
    ).not.toBeInTheDocument()
  })

  it('renders the mobile footer only inside the mobile main column', () => {
    render(
      <OnboardingLayout
        branding={<span />}
        introduction={<span>Intro</span>}
        mobileFooter={<span data-testid="mobile-footer">Mobile footer</span>}
      />,
    )

    expect(screen.getAllByTestId('mobile-footer')).toHaveLength(1)
    expect(
      within(screen.getByRole('main')).getByTestId('mobile-footer'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('complementary')).queryByTestId('mobile-footer'),
    ).not.toBeInTheDocument()
  })

  it('renders children once, inside the main column on every viewport', () => {
    render(
      <OnboardingLayout branding={<span />} introduction={<span>Intro</span>}>
        <span data-testid="child">Child</span>
      </OnboardingLayout>,
    )

    expect(screen.getAllByTestId('child')).toHaveLength(1)
    expect(
      within(screen.getByRole('main')).getByTestId('child'),
    ).toBeInTheDocument()
  })

  it('exposes no footer container when footer and mobileFooter are omitted', () => {
    render(
      <OnboardingLayout
        branding={<span />}
        introduction={<span>Intro</span>}
      />,
    )

    expect(screen.queryByTestId('footer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mobile-footer')).not.toBeInTheDocument()
  })
})
