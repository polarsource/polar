'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { brandSections } from './brand'
import { BrandContainer } from './primitives'

interface NavLink {
  label: string
  href: string
  download?: boolean
}

const navColumns: NavLink[][] = [
  [
    { label: 'Logo', href: '#logo' },
    { label: 'Color', href: '#color' },
    { label: 'Typography', href: '#typography' },
  ],
  [
    { label: 'Illustration', href: '#illustration' },
    { label: 'Voice', href: '#voice' },
    { label: 'Marketing', href: '#marketing' },
  ],
  [
    { label: 'Design', href: '#design' },
    {
      label: 'Assets',
      href: '/assets/brand/polar_brand.zip',
      download: true,
    },
  ],
]

const sectionIds = brandSections.map((section) => section.id)

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible.length > 0) {
          setActive(visible[0].target.id)
        }
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.5, 1] },
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [ids])

  return active
}

function NavItem({
  link,
  active,
  onSelect,
}: {
  link: NavLink
  active: boolean
  onSelect?: () => void
}) {
  const className = `text-xl transition-colors hover:text-brand-foreground ${
    active ? 'text-brand-foreground' : 'text-brand-muted'
  }`

  if (link.href.startsWith('#')) {
    return (
      <a href={link.href} className={className} onClick={onSelect}>
        {link.label}
      </a>
    )
  }

  return (
    <Link
      href={link.href}
      download={link.download}
      className={className}
      onClick={onSelect}
    >
      {link.label}
    </Link>
  )
}

export function BrandNav() {
  const activeSection = useActiveSection(sectionIds)

  return (
    <header className="bg-brand-raised sticky top-0 z-50">
      <BrandContainer className="flex flex-col py-6 md:flex-row md:items-start md:justify-between md:py-12">
        <div className="flex items-start justify-between">
          <Link href="/" className="flex flex-col text-xl">
            <span className="text-brand-foreground">— Polar</span>
            <span className="text-brand-muted">The Billing Company</span>
          </Link>
        </div>
        <nav className="hidden grid-cols-3 gap-x-12 md:grid md:gap-x-24">
          {navColumns.map((column, columnIndex) => (
            <div key={columnIndex} className="flex flex-col gap-1">
              {column.map((link, index) => (
                <NavItem
                  key={`${link.label}-${index}`}
                  link={link}
                  active={link.href === `#${activeSection}`}
                />
              ))}
            </div>
          ))}
        </nav>
      </BrandContainer>
    </header>
  )
}
