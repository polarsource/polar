import {
  BrandFooter,
  BrandHero,
  BrandNav,
  ColorSection,
  LogoSection,
  TypographySection,
  VoiceSection,
} from '@/components/Brand'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brand',
  description: 'The Polar brand system: logo, color, typography, and voice.',
}

export default function BrandPage() {
  return (
    <div className="font-neue-montreal min-h-screen bg-[#070708] text-[#575757] antialiased">
      <BrandNav />
      <main>
        <BrandHero />
        <LogoSection />
        <ColorSection />
        <TypographySection />
        <VoiceSection />
      </main>
      <BrandFooter />
    </div>
  )
}
