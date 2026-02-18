import React from 'react'
import { SectionLayout } from './SectionLayout'

export function ImagerySection() {
  return (
    <SectionLayout label="Imagery & Iconography">
      <div className="flex flex-col gap-8">
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex h-48 w-64 items-center justify-center rounded-2xl bg-neutral-100"
            >
              <span className="text-sm text-neutral-400">
                Image Placeholder
              </span>
            </div>
          ))}
        </div>
        <p className="max-w-md text-sm leading-relaxed text-neutral-400">
          Use clean, minimal imagery that emphasizes developer tools, interfaces,
          and abstract geometric patterns. Avoid stock photography with people.
        </p>
      </div>
    </SectionLayout>
  )
}
