import { cleanup, render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({
    href,
    target,
    children,
  }: {
    href: string
    target?: string
    children: ReactNode
  }) => (
    <a href={href} target={target}>
      {children}
    </a>
  ),
}))

vi.mock('@polar-sh/orbit', () => ({
  Grid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GridItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('./Logos', () => ({
  Tailwind: () => <div data-testid="logo-tailwind" />,
  FastAPICloud: () => <div data-testid="logo-fastapicloud" />,
  Confidence: () => <div data-testid="logo-confidence" />,
  StillaAIWordmark: () => <div data-testid="logo-stilla-ai" />,
}))

import { LogoGrid } from './LogoGrid'

const EXPECTED_LINKS: Record<string, string> = {
  'logo-tailwind': 'https://tailwindcss.com',
  'logo-fastapicloud': 'https://fastapicloud.com',
  'logo-confidence': 'https://confidence.spotify.com',
  'logo-stilla-ai': 'https://stilla.ai',
}

describe('LogoGrid', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders one external link per logo', () => {
    render(<LogoGrid />)
    expect(screen.getAllByRole('link')).toHaveLength(
      Object.keys(EXPECTED_LINKS).length,
    )
  })

  it('opens every logo link in a new tab', () => {
    render(<LogoGrid />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('target')).toBe('_blank')
    }
  })

  it('pairs each logo with its correct company URL', () => {
    render(<LogoGrid />)
    for (const [testid, url] of Object.entries(EXPECTED_LINKS)) {
      const link = screen.getByTestId(testid).closest('a')
      expect(link?.getAttribute('href')).toBe(url)
    }
  })

  it('links the Stilla AI logo to stilla.ai (not midday.ai)', () => {
    render(<LogoGrid />)
    const stillaLink = screen.getByTestId('logo-stilla-ai').closest('a')
    expect(stillaLink?.getAttribute('href')).toBe('https://stilla.ai')
  })

  it('does not link any logo to midday.ai', () => {
    render(<LogoGrid />)
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs).not.toContain('https://midday.ai')
  })
})
