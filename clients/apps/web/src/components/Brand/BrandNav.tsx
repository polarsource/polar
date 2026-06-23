'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { brandSections } from './brand'

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
    { label: 'Voice', href: '#voice' },
    { label: 'Principles', href: '#voice' },
    { label: 'Voice', href: '#voice' },
  ],
  [
    { label: 'Vision', href: '#voice' },
    {
      label: 'Assets',
      href: '/assets/brand/polar_brand.zip',
      download: true,
    },
    { label: 'Polar', href: '/' },
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

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  const className = `text-xl transition-colors hover:text-[#ADADAD] ${
    active ? 'text-[#ADADAD]' : 'text-[#575757]'
  }`

  if (link.href.startsWith('#')) {
    return (
      <a href={link.href} className={className}>
        {link.label}
      </a>
    )
  }

  return (
    <Link href={link.href} download={link.download} className={className}>
      {link.label}
    </Link>
  )
}

export function BrandNav() {
  const activeSection = useActiveSection(sectionIds)

  return (
    <header className="sticky top-0 z-50 bg-[#171717]">
      <div className="mx-auto flex w-full max-w-[1600px] items-start justify-between px-8 py-6 md:px-16 md:py-12">
        <Link href="/" className="flex flex-col text-xl tracking-tight">
          <span className="text-[#ADADAD]">— Polar</span>
          <span className="text-[#575757]">The Billing Company</span>
        </Link>
        <nav className="grid grid-cols-3 gap-x-12 md:gap-x-24">
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
      </div>
    </header>
  )
}
