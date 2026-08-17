import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@polar-sh/orbit', () => ({
  Avatar: () => <div data-testid="avatar" />,
  Grid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('./LogoGrid', () => ({
  LogoGrid: () => null,
}))

vi.mock('./Chapter', () => ({
  Chapter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

import { Testimonials } from './Testimonials'

const EXTERNAL_TESTIMONIAL_HREFS = [
  'https://x.com/rauchg/status/1909810055622672851',
  'https://x.com/mitchellh/status/1775925951668552005',
  'https://fastapicloud.com',
]

const INTERNAL_TESTIMONIAL_HREF = '/customers/stilla-ai'

describe('Testimonials', () => {
  it('renders all four testimonial links', () => {
    const { container } = render(<Testimonials />)

    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(4)
  })

  it('renders external testimonial links as native <a> with rel="noopener noreferrer"', () => {
    const { container } = render(<Testimonials />)

    for (const href of EXTERNAL_TESTIMONIAL_HREFS) {
      const link = container.querySelector(`a[href="${href}"]`)
      expect(link).not.toBeNull()
      expect(link?.getAttribute('target')).toBe('_blank')
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it('renders the internal testimonial link with target="_blank"', () => {
    const { container } = render(<Testimonials />)

    const link = container.querySelector(
      `a[href="${INTERNAL_TESTIMONIAL_HREF}"]`,
    )
    expect(link).not.toBeNull()
    expect(link?.getAttribute('target')).toBe('_blank')
  })

  it('does not set rel="noopener noreferrer" on internal links', () => {
    const { container } = render(<Testimonials />)

    const link = container.querySelector(
      `a[href="${INTERNAL_TESTIMONIAL_HREF}"]`,
    )
    expect(link).not.toBeNull()
    const rel = link?.getAttribute('rel')
    expect(rel ?? '').not.toContain('noreferrer')
  })

  it('classifies http(s) links as external and path links as internal', () => {
    const { container } = render(<Testimonials />)

    const externalLinks = container.querySelectorAll('a[href^="http"]')
    expect(externalLinks).toHaveLength(EXTERNAL_TESTIMONIAL_HREFS.length)
    externalLinks.forEach((link) => {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })

    const internalLinks = container.querySelectorAll('a[href^="/customers"]')
    expect(internalLinks).toHaveLength(1)
    expect(internalLinks[0].getAttribute('href')).toBe(
      INTERNAL_TESTIMONIAL_HREF,
    )
  })
})
