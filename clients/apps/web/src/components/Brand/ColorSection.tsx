import React from 'react'
import { BrandSection } from './BrandSection'
import { BrandColor, brandColors, brandSections } from './brand'

function isLight(hex: string): boolean {
  const v = parseInt(hex.replace('#', ''), 16)
  const r = (v >> 16) & 255
  const g = (v >> 8) & 255
  const b = v & 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}

function ColorColumn({ color }: { color: BrandColor }) {
  const light = isLight(color.hex)
  const fg = light ? '#070708' : '#F5F6FA'
  const muted = light ? 'rgba(7,7,8,0.5)' : 'rgba(245,246,250,0.5)'

  return (
    <div
      className="flex min-h-[60vh] flex-col justify-between p-8 md:min-h-[80vh] md:p-10"
      style={{ flex: color.flex, backgroundColor: color.hex, color: fg }}
    >
      <div className="flex items-baseline justify-between gap-x-8">
        <span className="text-base font-medium tracking-tight">
          {color.name}
        </span>
        <span className="text-base" style={{ color: muted }}>
          {color.role}
        </span>
      </div>
      <div className="flex flex-col gap-3 font-mono text-xs leading-snug">
        <div className="flex flex-col gap-0.5">
          <span style={{ color: muted }}>HEX</span>
          <span>{color.hex}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ color: muted }}>OKLCH</span>
          <span className="whitespace-nowrap">{color.oklch}</span>
        </div>
      </div>
    </div>
  )
}

export function ColorSection() {
  return (
    <BrandSection
      meta={brandSections[1]}
      title="A monochrome color system"
      lead="The palette runs from Night to Snow in a single neutral hue. Ether is the only accent, reserved for moments that need to carry energy."
    >
      <div className="flex w-full flex-col overflow-hidden md:flex-row">
        {brandColors.map((color) => (
          <ColorColumn key={color.name} color={color} />
        ))}
      </div>
    </BrandSection>
  )
}
