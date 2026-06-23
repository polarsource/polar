import Link from 'next/link'
import React from 'react'

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

function NavItem({ link, lead }: { link: NavLink; lead: boolean }) {
  const className = `text-lg transition-colors hover:text-[#F5F6FA] ${'text-[#575757]'}`

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
  return (
    <header className="sticky top-0 z-50 bg-[#171717]">
      <div className="mx-auto flex w-full max-w-[1600px] items-start justify-between px-8 py-6 md:px-16 md:py-12">
        <Link href="/" className="flex flex-col text-lg tracking-tight">
          <span className="text-[#ADADAD]">— Polar</span>
          <span className="text-[#575757]">The Billing Company</span>
        </Link>
        <nav className="grid grid-cols-3 gap-x-12 md:gap-x-24">
          {navColumns.map((column, columnIndex) => (
            <div key={columnIndex} className="flex flex-col gap-1">
              {column.map((link, index) => (
                <NavItem key={link.label} link={link} lead={index === 0} />
              ))}
            </div>
          ))}
        </nav>
      </div>
    </header>
  )
}
