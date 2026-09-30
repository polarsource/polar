import { Box } from '@polar-sh/orbit/Box'
import { ClosingCta } from '../ClosingCta'
import { Api } from './Api'
import { Cli } from './Cli'
import { IntegrateHero } from './IntegrateHero'
import { Mcp } from './Mcp'
import { Sdk } from './Sdk'

export const IntegratePage = () => (
  <Box width="100%" flexDirection="column">
    <IntegrateHero />
    <Mcp />
    <Sdk />
    <Cli />
    <Api />
    <ClosingCta />
  </Box>
)
