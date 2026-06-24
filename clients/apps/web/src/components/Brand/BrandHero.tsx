import React from 'react'
import { brandSections } from './brand'

export function BrandHero() {
  return (
    <section className="flex min-h-[calc(100vh-164px)] flex-col justify-between gap-y-16 bg-[#171717] pt-20 pb-16 md:gap-y-48 md:pt-32 md:pb-24">
      <div className="mx-auto flex w-full max-w-[1600px] grow flex-col justify-end gap-10 px-8 md:px-16">
        <h1 className="max-w-[15ch] text-[clamp(3rem,10vw,11rem)] leading-[0.92] font-[350] tracking-tight text-[#ADADAD]">
          Identity for the intelligence era
        </h1>
      </div>
      <div className="mx-auto w-full max-w-[1600px] px-8 md:px-16">
        <div className="grid grid-cols-1 gap-12 border-t border-[#575757] pt-12 md:grid-cols-3 md:gap-8 md:pt-16">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-sm text-[#575757]">000</span>
            <span className="text-lg text-[#575757]">Brand System</span>
          </div>
          <p className="max-w-md text-base leading-relaxed text-[#575757] md:text-lg">
            The visual language of Polar. A precise, monochrome system built to
            stay legible and unmistakable at any scale.
          </p>
          <nav className="flex flex-col gap-3 md:items-end">
            {brandSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-baseline gap-4 text-lg text-[#575757] transition-colors hover:text-[#F5F6FA]"
              >
                <span className="font-mono text-sm text-[#575757]">
                  {section.index}
                </span>
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </section>
  )
}
