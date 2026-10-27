'use client'

import { Corners } from './Corners'
import { DesignPartnerForm } from '@/components/Landing/design-partner/DesignPartnerForm'

/** The end of the book: what early access is, beside the form to ask for it. */
export function EarlyAccess() {
  return (
    <section
      id="early-access"
      className="grid scroll-mt-6 grid-cols-1 gap-16 pt-6 pb-56 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="flex max-w-[600px] flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <h1 className="m-0 text-[35px] leading-[1.15] font-medium tracking-[-0.01em] text-[#d8d8d8]">
          Early access
        </h1>
        <p className="m-0 text-[20px] leading-[1.35] font-[450] text-[#7b7b7b]">
          We&apos;re building agent-first billing with a small group of AI
          startups. Tell us about yours, and we&apos;ll bring you in early, with
          a direct line to the team building it.
        </p>
      </div>
      <div className="relative border border-[#2a2a2a] [&>form]:bg-transparent!">
        <Corners />
        <DesignPartnerForm compact submitLabel="Request early access" />
      </div>
    </section>
  )
}
