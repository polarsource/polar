'use client'

import React, { useCallback, useState } from 'react'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'
import LogoIcon from './logos/LogoIcon'
import LogoType from './logos/LogoType'

const LOGO_ICON_SVG = `<svg width="29" height="29" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fillRule="evenodd" clipRule="evenodd" d="M9.07727 23.0572C13.8782 26.307 20.4046 25.0496 23.6545 20.2487C26.9043 15.4478 25.6469 8.92133 20.846 5.67149C16.0451 2.42165 9.51862 3.67905 6.26878 8.47998C3.01894 13.2809 4.27634 19.8073 9.07727 23.0572ZM10.4703 23.1428C14.862 25.3897 20.433 23.2807 22.9135 18.4322C25.394 13.5838 23.8447 7.83194 19.4531 5.58511C15.0614 3.33829 9.49042 5.4473 7.00991 10.2957C4.52939 15.1442 6.07867 20.896 10.4703 23.1428Z" fill="currentColor"/>
  <path fillRule="evenodd" clipRule="evenodd" d="M11.7222 24.2898C15.6865 25.58 20.35 22.1715 22.1385 16.6765C23.927 11.1815 22.1632 5.68099 18.1989 4.39071C14.2346 3.10043 9.5711 6.509 7.78261 12.004C5.99412 17.4989 7.75793 22.9995 11.7222 24.2898ZM12.9347 23.872C16.2897 24.5876 19.9174 20.9108 21.0374 15.6596C22.1574 10.4084 20.3457 5.57134 16.9907 4.85575C13.6357 4.14016 10.008 7.817 8.88797 13.0682C7.76793 18.3194 9.57971 23.1564 12.9347 23.872Z" fill="currentColor"/>
  <path fillRule="evenodd" clipRule="evenodd" d="M13.8537 24.7382C16.5062 25.0215 19.1534 20.5972 19.7664 14.8563C20.3794 9.1155 18.7261 4.23202 16.0736 3.94879C13.4211 3.66556 10.7739 8.08983 10.1609 13.8307C9.54788 19.5715 11.2012 24.455 13.8537 24.7382ZM15.0953 22.9906C17.015 22.9603 18.5101 19.0742 18.4349 14.3108C18.3596 9.54747 16.7424 5.71058 14.8228 5.7409C12.9032 5.77123 11.408 9.6573 11.4833 14.4207C11.5585 19.184 13.1757 23.0209 15.0953 22.9906Z" fill="currentColor"/>
</svg>`

const panelClass =
  'flex aspect-[4/3] items-center justify-center transition-colors'

const actionClass =
  'rounded-full border border-[#1D1E22] px-5 py-2.5 text-sm text-[#575757] transition-colors hover:border-[#575757] hover:text-[#F5F6FA]'

export function LogoSection() {
  const [copied, setCopied] = useState(false)

  const copyIcon = useCallback(() => {
    navigator.clipboard.writeText(LOGO_ICON_SVG)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }, [])

  return (
    <BrandSection
      meta={brandSections[0]}
      title="One mark, in any context"
      lead="The icon and wordmark are the fixed core of the identity. Reproduce them in full white on dark or full black on light. Never recolor, rotate, or distort the mark."
    >
      <div className="flex flex-col gap-12 md:gap-16">
        <div className="grid grid-cols-1 gap-8 overflow-hidden md:grid-cols-2">
          <div className={`${panelClass} bg-[#171717]`}>
            <LogoIcon size={88} className="text-[#adadad]" />
          </div>
          <div className={`${panelClass} bg-[#adadad]`}>
            <LogoIcon size={88} className="text-[#171717]" />
          </div>
          <div className={`${panelClass} bg-[#adadad]`}>
            <LogoType width={240} className="text-[#171717]" />
          </div>
          <div className={`${panelClass} bg-[#171717]`}>
            <LogoType width={240} className="text-[#adadad]" />
          </div>
        </div>
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <p className="max-w-md text-sm leading-relaxed text-[#575757]">
            Keep clear space around the mark equal to the height of the icon.
            Minimum icon size is 16px.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={copyIcon} className={actionClass}>
              {copied ? 'Copied' : 'Copy icon SVG'}
            </button>
            <a
              href="/assets/brand/polar_brand.zip"
              download
              className={actionClass}
            >
              Download assets
            </a>
          </div>
        </div>
      </div>
    </BrandSection>
  )
}
