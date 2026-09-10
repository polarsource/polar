import noAnsiEscapes from './rules/no-ansi-escapes.js'
import noOutputInServices from './rules/no-output-in-services.js'
import noProcessEnv from './rules/no-process-env.js'

export default {
  meta: { name: 'polar' },
  rules: {
    'no-ansi-escapes': noAnsiEscapes,
    'no-output-in-services': noOutputInServices,
    'no-process-env': noProcessEnv,
  },
}
