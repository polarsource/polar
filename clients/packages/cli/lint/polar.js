import commandBoundaries from './rules/command-boundaries.js'
import commandDescriptions from './rules/command-descriptions.js'
import noAnsiEscapes from './rules/no-ansi-escapes.js'
import noEffectRunOutsideEntrypoint from './rules/no-effect-run-outside-entrypoint.js'
import noHardcodedHosts from './rules/no-hardcoded-hosts.js'
import noProcessEnv from './rules/no-process-env.js'
import serviceBoundaries from './rules/service-boundaries.js'
import testColocation from './rules/test-colocation.js'

export default {
  meta: { name: 'polar' },
  rules: {
    'command-boundaries': commandBoundaries,
    'command-descriptions': commandDescriptions,
    'no-ansi-escapes': noAnsiEscapes,
    'no-effect-run-outside-entrypoint': noEffectRunOutsideEntrypoint,
    'no-hardcoded-hosts': noHardcodedHosts,
    'no-process-env': noProcessEnv,
    'service-boundaries': serviceBoundaries,
    'test-colocation': testColocation,
  },
}
