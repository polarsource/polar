import Link from 'next/link'
import React from 'react'
import { brandSections } from './brand'

export function BrandNav() {
  return (
    <header className="sticky top-0 z-50 bg-[#171717]">
      <div className="mx-auto flex w-full max-w-[1600px] items-start justify-between px-8 py-6 md:px-16 md:py-8">
        <Link href="/" className="flex flex-col text-lg tracking-tight">
          <span className="text-[#ADADAD]">— Polar</span>
          <span className="text-[#575757]">The Billing Company</span>
        </Link>
        <nav className="flex flex-wrap justify-end gap-x-8 gap-y-2">
          {brandSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="text-sm text-[#575757] transition-colors hover:text-[#F5F6FA]"
            >
              {section.label}
            </a>
          ))}
          <Link
            href="/"
            className="text-sm text-[#575757] transition-colors hover:text-[#F5F6FA]"
          >
            polar.sh
          </Link>
        </nav>
      </div>
    </header>
  )
}
