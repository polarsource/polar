import commandBoundaries from './rules/command-boundaries.js'
import commandDescriptions from './rules/command-descriptions.js'
import commandExamples from './rules/command-examples.js'
import commandsOnly from './rules/commands-only.js'
import commandsOutputJson from './rules/commands-output-json.js'
import flagConventions from './rules/flag-conventions.js'
import noAnsiEscapes from './rules/no-ansi-escapes.js'
import noDoubleCast from './rules/no-double-cast.js'
import noEffectRunOutsideEntrypoint from './rules/no-effect-run-outside-entrypoint.js'
import noHardcodedHosts from './rules/no-hardcoded-hosts.js'
import noProcessEnv from './rules/no-process-env.js'
import noYesFlag from './rules/no-yes-flag.js'
import schemasArePure from './rules/schemas-are-pure.js'
import serviceFacade from './rules/service-facade.js'
import sharedFlags from './rules/shared-flags.js'
import serviceBoundaries from './rules/service-boundaries.js'
import testColocation from './rules/test-colocation.js'
import utilsBoundaries from './rules/utils-boundaries.js'

export default {
  meta: { name: 'polar-cli' },
  rules: {
    'command-boundaries': commandBoundaries,
    'command-descriptions': commandDescriptions,
    'command-examples': commandExamples,
    'commands-only': commandsOnly,
    'commands-output-json': commandsOutputJson,
    'flag-conventions': flagConventions,
    'no-ansi-escapes': noAnsiEscapes,
    'no-double-cast': noDoubleCast,
    'no-effect-run-outside-entrypoint': noEffectRunOutsideEntrypoint,
    'no-hardcoded-hosts': noHardcodedHosts,
    'no-process-env': noProcessEnv,
    'no-yes-flag': noYesFlag,
    'schemas-are-pure': schemasArePure,
    'service-facade': serviceFacade,
    'service-boundaries': serviceBoundaries,
    'shared-flags': sharedFlags,
    'test-colocation': testColocation,
    'utils-boundaries': utilsBoundaries,
  },
}
