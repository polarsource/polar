import React from 'react'
import { Body, BrandContainer, Display, Label, Mono } from './primitives'

export function BrandHero() {
  return (
    <section className="bg-brand-raised flex min-h-[calc(100vh-164px)] flex-col justify-between gap-y-16 pt-20 pb-16 md:gap-y-48 md:pt-32 md:pb-24">
      <BrandContainer className="flex grow flex-col justify-end gap-10">
        <Display className="max-w-[15ch]">
          Identity for the intelligence era
        </Display>
      </BrandContainer>
      <BrandContainer>
        <div className="border-brand-muted grid grid-cols-1 gap-12 border-t pt-12 md:grid-cols-3 md:gap-8 md:pt-16">
          <div className="flex flex-col gap-3">
            <Mono>000</Mono>
            <Label>Brand System</Label>
          </div>
          <Body className="max-w-md">
            The visual language of Polar. A precise, monochrome system built to
            stay legible and unmistakable at any scale.
          </Body>
        </div>
      </BrandContainer>
    </section>
  )
}
