import React from 'react'
import { SectionLayout } from './SectionLayout'

const spacingMultipliers = [1, 2, 3, 4, 6, 8, 12, 16]

const radiusTokens = [
  { label: '8px', className: 'rounded-lg' },
  { label: '12px', className: 'rounded-xl' },
  { label: '16px', className: 'rounded-2xl' },
  { label: '32px', className: 'rounded-[32px]' },
]

export function SpacingSection() {
  return (
    <SectionLayout label="Spacing & Grid">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <span className="text-sm font-medium text-neutral-500">
            8px Base Unit
          </span>
          <div className="flex items-end gap-3">
            {spacingMultipliers.map((multiplier) => (
              <div
                key={multiplier}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className="rounded bg-blue-500"
                  style={{
                    width: multiplier * 8,
                    height: multiplier * 8,
                  }}
                />
                <span className="text-xs text-neutral-400">
                  {multiplier * 8}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <span className="text-sm font-medium text-neutral-500">
            Border Radius
          </span>
          <div className="flex items-center gap-6">
            {radiusTokens.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`h-20 w-20 border-2 border-neutral-300 ${item.className}`}
                />
                <span className="text-xs text-neutral-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionLayout>
  )
}
