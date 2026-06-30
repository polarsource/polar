import Link from 'next/link'
import React from 'react'
import { BrandContainer } from '../Brand/primitives'

const links = [
  { label: 'Directory', href: '/pricing-directory#directory' },
  { label: 'Compare', href: '/pricing-directory/compare' },
  { label: 'Changes', href: '/pricing-directory#changes' },
  { label: 'Reading', href: '/pricing-directory#reading' },
]

export function PricingDirectoryNav() {
  return (
    <header className="bg-brand-raised sticky top-0 z-50">
      <BrandContainer className="flex items-start justify-between gap-6 py-6 md:py-12">
        <Link
          href="/pricing-directory"
          className="flex flex-col text-xl tracking-tight"
        >
          <span className="text-brand-foreground">— Polar</span>
          <span className="text-brand-muted">Pricing Directory</span>
        </Link>
        <nav className="flex flex-wrap justify-end gap-x-6 gap-y-1 md:gap-x-10">
          {links.map((link) => {
            const className =
              'text-base text-brand-muted transition-colors hover:text-brand-foreground md:text-xl'
            return link.href.startsWith('#') ? (
              <a key={link.label} href={link.href} className={className}>
                {link.label}
              </a>
            ) : (
              <Link key={link.label} href={link.href} className={className}>
                {link.label}
              </Link>
            )
          })}
        </nav>
      </BrandContainer>
    </header>
  )
}
