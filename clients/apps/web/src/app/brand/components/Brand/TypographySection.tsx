import React from 'react'
import { SectionLayout } from './SectionLayout'

export function TypographySection() {
  return (
    <SectionLayout label="04 / Typography">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Display
          </span>
          <span className="text-6xl font-semibold tracking-tight">
            Aa Bb Cc Dd
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Heading
          </span>
          <span className="text-3xl font-semibold tracking-tight">
            The quick brown fox jumps over the lazy dog
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Body
          </span>
          <span className="max-w-lg text-lg leading-relaxed text-neutral-600">
            The quick brown fox jumps over the lazy dog. Pack my box with five
            dozen liquor jugs.
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Caption
          </span>
          <span className="text-sm text-neutral-400">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
          </span>
        </div>
      </div>
    </SectionLayout>
  )
}
