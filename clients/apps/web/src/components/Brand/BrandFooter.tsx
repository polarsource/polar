import React from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { BrandContainer } from './primitives'

export function BrandFooter() {
  return (
    <footer className="bg-brand-raised flex flex-col gap-20 py-24 md:gap-32 md:py-40">
      <BrandContainer className="flex flex-col items-center">
        <PolarLogotype
          className="text-brand-muted"
          logoVariant="icon"
          size={80}
        />
      </BrandContainer>
    </footer>
  )
}
