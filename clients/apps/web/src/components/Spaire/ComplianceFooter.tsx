'use client'

import { twMerge } from 'tailwind-merge'

/**
 * Compliance Footer Component
 * Required bank disclosures and legal information
 *
 * Features:
 * - Legible font size (minimum 13px)
 * - Uses "Financial Account" terminology
 * - Clean, professional appearance
 * - 8px grid compliant
 */

interface ComplianceFooterProps {
  className?: string
  bankPartner?: string
  companyName?: string
}

export default function ComplianceFooter({
  className,
  bankPartner = 'Evolve Bank & Trust',
  companyName = 'Spaire Technologies, Inc.',
}: ComplianceFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={twMerge(
        'w-full border-t border-[#E3E8EF] dark:border-[#1E3A5F]',
        'bg-[#F6F9FC] dark:bg-[#0A192F]',
        'px-6 py-8 md:px-8 lg:px-12',
        className
      )}
    >
      <div className="mx-auto max-w-6xl">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
          {/* Company Info */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635BFF]">
                <span className="text-sm font-semibold text-white">S</span>
              </div>
              <span className="text-base font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
                Spaire
              </span>
            </div>
            <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em] leading-relaxed">
              Financial infrastructure for modern businesses.
            </p>
          </div>

          {/* Products */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
              Products
            </h4>
            <nav className="flex flex-col gap-2">
              <FooterLink href="#">Treasury</FooterLink>
              <FooterLink href="#">Commercial Cards</FooterLink>
              <FooterLink href="#">Payments</FooterLink>
              <FooterLink href="#">Issuing</FooterLink>
            </nav>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
              Resources
            </h4>
            <nav className="flex flex-col gap-2">
              <FooterLink href="#">Documentation</FooterLink>
              <FooterLink href="#">API Reference</FooterLink>
              <FooterLink href="#">Support</FooterLink>
              <FooterLink href="#">Status</FooterLink>
            </nav>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
              Legal
            </h4>
            <nav className="flex flex-col gap-2">
              <FooterLink href="#">Privacy Policy</FooterLink>
              <FooterLink href="#">Terms of Service</FooterLink>
              <FooterLink href="#">Cookie Policy</FooterLink>
              <FooterLink href="#">Licenses</FooterLink>
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-[#E3E8EF] dark:border-[#1E3A5F]" />

        {/* Bank Disclosures */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {/* FDIC Notice */}
            <p className="text-[13px] text-[#697386] dark:text-[#8892B0] leading-relaxed">
              Financial Account services are provided by {bankPartner}, Member FDIC.
              The {companyName} Visa Commercial Card is issued by {bankPartner}, Member FDIC,
              pursuant to a license from Visa U.S.A. Inc.
            </p>

            {/* Not a Bank Disclosure */}
            <p className="text-[13px] text-[#697386] dark:text-[#8892B0] leading-relaxed">
              {companyName} is a financial technology company, not a bank.
              Financial Account services are provided by {bankPartner}, Member FDIC.
              Funds held in your Financial Account are eligible for FDIC insurance up to $250,000.
            </p>

            {/* Additional Disclosures */}
            <p className="text-[13px] text-[#697386] dark:text-[#8892B0] leading-relaxed">
              The Annual Percentage Yield (APY) for the Financial Account is variable and may change at any time.
              The quoted APY is accurate as of the date shown. No minimum balance is required.
              Interest is compounded daily and credited monthly.
            </p>
          </div>

          {/* Copyright & Additional Links */}
          <div className="flex flex-col gap-4 pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-[13px] text-[#8792A2] dark:text-[#5C6B8A]">
              &copy; {currentYear} {companyName}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <FooterLink href="#" size="sm">Privacy</FooterLink>
              <FooterLink href="#" size="sm">Terms</FooterLink>
              <FooterLink href="#" size="sm">Cookies</FooterLink>
              <FooterLink href="#" size="sm">Accessibility</FooterLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

/**
 * Footer Link Component
 */
interface FooterLinkProps {
  href: string
  children: React.ReactNode
  size?: 'sm' | 'md'
}

function FooterLink({ href, children, size = 'md' }: FooterLinkProps) {
  return (
    <a
      href={href}
      className={twMerge(
        'text-[#697386] dark:text-[#8892B0]',
        'hover:text-[#0A2540] dark:hover:text-[#E6F1FF]',
        'transition-colors duration-150',
        'tracking-[-0.01em]',
        size === 'sm' ? 'text-[13px]' : 'text-sm'
      )}
    >
      {children}
    </a>
  )
}
