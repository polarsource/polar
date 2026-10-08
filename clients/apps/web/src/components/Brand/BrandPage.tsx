import { Box } from '@polar-sh/orbit/Box'
import { BrandHero } from './BrandHero'
import { ColorSection } from './ColorSection'
import { IllustrationSection } from './IllustrationSection'
import { LogoSection } from './LogoSection'
import { MarketingSection } from './MarketingSection'
import { TypographySection } from './TypographySection'
import { VoiceSection } from './VoiceSection'

export const BrandPage = () => (
  <Box width="100%" flexDirection="column">
    <BrandHero />
    <LogoSection />
    <ColorSection />
    <TypographySection />
    <IllustrationSection />
    <VoiceSection />
    <MarketingSection />
  </Box>
)
