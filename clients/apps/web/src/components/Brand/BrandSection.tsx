import React from 'react'
import { BrandSectionMeta } from './brand'

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
    <section id={meta.id} className="scroll-mt-24 bg-[#1A1A1A] py-24 md:py-40">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-16 px-8 md:gap-28 md:px-16">
        <div className="flex flex-col gap-10 md:gap-14">
          <div className="flex items-center gap-x-3 text-2xl text-[#575757]">
            <span>{meta.index}</span>
            <span className="h-px w-12 bg-[#575757]" />
            <span>{meta.label}</span>
          </div>
          <h2 className="max-w-5xl text-[clamp(2.75rem,7vw,7rem)] leading-[0.95] font-light tracking-[-0.01em] text-balance text-[#ADADAD]">
            {title}
          </h2>
          {lead ? (
            <p className="max-w-2xl text-lg leading-relaxed text-[#575757] md:text-2xl">
              {lead}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  )
}
