'use client'

import { Button } from '@polar-sh/orbit'
import React, { useCallback, useState } from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import LogoIcon from './logos/LogoIcon'
import LogoLoader from './logos/LogoLoader'
import LogoReveal from './logos/LogoReveal'
import LogoType from './logos/LogoType'
import { Body, Label } from './primitives'

const LOGO_ICON_SVG = `<svg width="310" height="310" viewBox="0 0 310 310" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M139.5 193.65L61.48 271.67L39.11 249.31L117.13 171.29H0.85C0.29 165.94 0 160.5 0 155C0 149.82 0.25 144.71 0.75 139.66H117.13L34.71 57.24C41.38 49.04 48.88 41.54 57.06 34.85L139.5 117.29V0.77C144.6 0.26 149.77 0 155 0C160.45 0 165.83 0.28 171.14 0.83V309.17C165.83 309.72 160.45 310 155 310C149.77 310 144.6 309.74 139.5 309.23ZM209.41 155.48C209.41 110.36 227.85 68.62 257.44 38.67C266.17 46.37 274.03 55.03 280.85 64.5C258.28 88.02 244.2 120.49 244.2 155.48C244.2 190.28 258.52 221.27 281.43 244.69C274.67 254.2 266.87 262.91 258.19 270.66C228.64 241.24 209.41 201.13 209.41 155.48Z" fill="currentColor"/>
</svg>`

const panelClass =
  'flex aspect-[4/3] items-center justify-center transition-colors'

export function LogoSection() {
  const [copied, setCopied] = useState(false)
  const [revealRun, setRevealRun] = useState(0)

  const copyIcon = useCallback(() => {
    navigator.clipboard.writeText(LOGO_ICON_SVG)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }, [])

  return (
    <BrandSection
      meta={brandSections[0]}
      title="The mark, held constant"
      lead="The icon and wordmark are the fixed core of the identity. Reproduce them in full white on dark or full black on light. Never recolor, rotate, or distort the mark."
    >
      <div className="flex flex-col gap-12 md:gap-16">
        <div className="grid grid-cols-1 gap-8 overflow-hidden md:grid-cols-2">
          <div className={`${panelClass} bg-brand-raised`}>
            <LogoIcon size={88} className="text-brand-foreground" />
          </div>
          <div className={`${panelClass} bg-brand-foreground`}>
            <LogoIcon size={88} className="text-brand-surface" />
          </div>
          <div className={`${panelClass} bg-brand-foreground`}>
            <LogoType width={240} className="text-brand-surface" />
          </div>
          <div className={`${panelClass} bg-brand-raised`}>
            <LogoType width={240} className="text-brand-foreground" />
          </div>
          <button
            type="button"
            onClick={() => setRevealRun((run) => run + 1)}
            className={`${panelClass} bg-brand-raised relative cursor-pointer`}
          >
            <LogoReveal
              key={revealRun}
              size={240}
              className="text-brand-foreground"
            />
            <Label className="absolute bottom-6 left-6">Reveal</Label>
            <Label className="absolute right-6 bottom-6">Click to replay</Label>
          </button>
          <div className={`${panelClass} bg-brand-foreground relative`}>
            <LogoLoader size={88} className="text-brand-surface" />
            <Label className="absolute bottom-6 left-6">Loading</Label>
          </div>
        </div>
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Body className="max-w-md">
            Keep clear space around the mark equal to the height of the icon.
            Minimum icon size is 16px.
          </Body>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={copyIcon}>
              {copied ? 'Copied' : 'Copy icon SVG'}
            </Button>
            <Button variant="secondary" asChild>
              <a href="/assets/brand/polar_brand.zip" download>
                Download assets
              </a>
            </Button>
          </div>
        </div>
      </div>
    </BrandSection>
  )
}
