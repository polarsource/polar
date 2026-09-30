import LogoReveal from '@/components/Brand/logos/LogoReveal'
import { Box } from '@polar-sh/orbit/Box'

export const HeroMark = () => (
  <Box
    display={{ base: 'none', lg: 'block' }}
    color="text-primary"
    opacity={0.15}
  >
    <LogoReveal variant="mark" size={96} />
  </Box>
)
