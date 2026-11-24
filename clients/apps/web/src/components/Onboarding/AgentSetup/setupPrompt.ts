import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'

const isLocal = CONFIG.ENVIRONMENT === 'development'
const RUNNER = isLocal ? 'dev polar' : 'npx @polar-sh/cli'
const ENVIRONMENT_FLAG = isLocal
  ? ' --local'
  : CONFIG.IS_SANDBOX
    ? ' --sandbox'
    : ''

export const buildSetupPrompt = (
  organization: schemas['Organization'],
  code: string,
) =>
  `Run \`${RUNNER} setup ${organization.slug}#${code}${ENVIRONMENT_FLAG}\` and follow the instructions it prints.`
