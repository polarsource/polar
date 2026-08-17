import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

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

const LOGO_LINKS = [
  'https://tailwindcss.com',
  'https://fastapicloud.com',
  'https://confidence.spotify.com',
  'https://stilla.ai',
]

describe('LogoGrid', () => {
  it('renders a native <a> element for each external logo', () => {
    const { container } = render(<LogoGrid />)

    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(LOGO_LINKS.length)

    LOGO_LINKS.forEach((href, index) => {
      expect(links[index].getAttribute('href')).toBe(href)
    })
  })

  it('sets target="_blank" on every logo link', () => {
    const { container } = render(<LogoGrid />)

    const links = container.querySelectorAll('a')
    links.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank')
    })
  })

  it('sets rel="noopener noreferrer" on every logo link', () => {
    const { container } = render(<LogoGrid />)

    const links = container.querySelectorAll('a')
    links.forEach((link) => {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })

  it('does not link any logo to midday.ai', () => {
    const { container } = render(<LogoGrid />)

    const hrefs = Array.from(container.querySelectorAll('a')).map((link) =>
      link.getAttribute('href'),
    )
    expect(hrefs).not.toContain('https://midday.ai')
  })
})
