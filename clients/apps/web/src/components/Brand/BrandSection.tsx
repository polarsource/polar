import React from 'react'
import { BrandSectionMeta } from './brand'
import { BrandContainer, Heading, Lead } from './primitives'

export function BrandSection({
  meta,
  title,
  lead,
  children,
}: {
  meta: BrandSectionMeta
  title: React.ReactNode
  lead?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={meta.id} className="scroll-mt-24 py-24 md:py-40">
      <BrandContainer className="flex flex-col gap-16 md:gap-28">
        <div className="flex flex-col gap-10 md:gap-14">
          <div className="text-brand-muted flex items-center gap-x-3 text-2xl">
            <span>{meta.index}</span>
            <span className="bg-brand-muted h-px w-12" />
            <span>{meta.label}</span>
          </div>
          <Heading className="max-w-5xl">{title}</Heading>
          {lead ? <Lead>{lead}</Lead> : null}
        </div>
        {children}
      </BrandContainer>
    </section>
  )
}
