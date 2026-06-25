import {
  BrandFooter,
  BrandHero,
  BrandNav,
  ColorSection,
  IllustrationSection,
  LogoSection,
  TypographySection,
  VoiceSection,
} from '@/components/Brand'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brand',
  description:
    'The Polar brand system: logo, color, typography, illustration, and voice.',
}

export default function BrandPage() {
  return (
    <div className="font-neue-montreal bg-brand-surface text-brand-muted min-h-screen antialiased">
      <BrandNav />
      <main>
        <BrandHero />
        <LogoSection />
        <ColorSection />
        <TypographySection />
        <IllustrationSection />
        <VoiceSection />
      </main>
      <BrandFooter />
    </div>
  )
}
