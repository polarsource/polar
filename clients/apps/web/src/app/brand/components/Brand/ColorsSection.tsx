import React from 'react'
import { SectionLayout } from './SectionLayout'

const primaryColors = [
  { name: 'Black', hex: '#000000', bg: 'bg-black' },
  { name: 'White', hex: '#FFFFFF', bg: 'bg-white border border-neutral-200' },
  { name: 'Blue 500', hex: '#0062FF', bg: 'bg-blue-500' },
  { name: 'Blue 600', hex: '#004FCC', bg: 'bg-blue-600' },
]

const grayColors = [
  { name: 'Gray 50', hex: '#FAFAFA', bg: 'bg-neutral-50 border border-neutral-200' },
  { name: 'Gray 100', hex: '#F5F5F5', bg: 'bg-neutral-100' },
  { name: 'Gray 200', hex: '#E5E5E5', bg: 'bg-neutral-200' },
  { name: 'Gray 400', hex: '#A3A3A3', bg: 'bg-neutral-400' },
  { name: 'Gray 500', hex: '#737373', bg: 'bg-neutral-500' },
  { name: 'Gray 900', hex: '#171717', bg: 'bg-neutral-900' },
]

export function ColorsSection() {
  return (
    <SectionLayout label="03 / Color Palette">
      <div className="flex flex-col gap-8">
        <div className="flex gap-6">
          {primaryColors.map((color) => (
            <div key={color.name} className="flex flex-col gap-3">
              <div className={`h-32 w-32 rounded-2xl ${color.bg}`} />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{color.name}</span>
                <span className="text-xs text-neutral-400">{color.hex}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-6">
          {grayColors.map((color) => (
            <div key={color.name} className="flex flex-col gap-3">
              <div className={`h-20 w-20 rounded-xl ${color.bg}`} />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">{color.name}</span>
                <span className="text-xs text-neutral-400">{color.hex}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionLayout>
  )
}
