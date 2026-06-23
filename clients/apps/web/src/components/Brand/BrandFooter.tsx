import React from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'

export function BrandFooter() {
  return (
    <footer className="flex flex-col gap-20 bg-[#171717] py-24 md:gap-32 md:py-40">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center px-8 md:px-16">
        <PolarLogotype
          className="text-[#575757]"
          logoVariant="icon"
          size={80}
        />
      </div>
    </footer>
  )
}
