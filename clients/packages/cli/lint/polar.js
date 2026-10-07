import commandBoundaries from './rules/command-boundaries.js'
import commandDescriptions from './rules/command-descriptions.js'
import commandsOnly from './rules/commands-only.js'
import commandsOutputJson from './rules/commands-output-json.js'
import noAnsiEscapes from './rules/no-ansi-escapes.js'
import noEffectRunOutsideEntrypoint from './rules/no-effect-run-outside-entrypoint.js'
import noHardcodedHosts from './rules/no-hardcoded-hosts.js'
import noProcessEnv from './rules/no-process-env.js'
import schemasArePure from './rules/schemas-are-pure.js'
import serviceFacade from './rules/service-facade.js'
import serviceBoundaries from './rules/service-boundaries.js'
import testColocation from './rules/test-colocation.js'
import utilsBoundaries from './rules/utils-boundaries.js'

export default {
  meta: { name: 'polar-cli' },
  rules: {
    'command-boundaries': commandBoundaries,
    'command-descriptions': commandDescriptions,
    'commands-only': commandsOnly,
    'commands-output-json': commandsOutputJson,
    'no-ansi-escapes': noAnsiEscapes,
    'no-effect-run-outside-entrypoint': noEffectRunOutsideEntrypoint,
    'no-hardcoded-hosts': noHardcodedHosts,
    'no-process-env': noProcessEnv,
    'schemas-are-pure': schemasArePure,
    'service-facade': serviceFacade,
    'service-boundaries': serviceBoundaries,
    'test-colocation': testColocation,
    'utils-boundaries': utilsBoundaries,
  },
}
