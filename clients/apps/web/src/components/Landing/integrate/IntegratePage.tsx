import { Box } from '@polar-sh/orbit/Box'
import { ClosingCta } from '../ClosingCta'
import { Api } from './Api'
import { Cli } from './Cli'
import { IntegrateHero } from './IntegrateHero'
import { Mcp } from './Mcp'
import { Quickstart } from './Quickstart'
import { Sdk } from './Sdk'
import { SurfaceCards } from './SurfaceCards'

export const IntegratePage = () => (
  <Box width="100%" flexDirection="column">
    <IntegrateHero />
    <Quickstart />
    <Box
      as="section"
      width="100%"
      paddingTop={{ base: '3xl', md: '5xl' }}
      paddingBottom={{ base: '3xl', md: '5xl' }}
    >
      <SurfaceCards />
    </Box>
    <Mcp />
    <Sdk />
    <Cli />
    <Api />
    <ClosingCta />
  </Box>
)
