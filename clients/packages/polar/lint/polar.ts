import clientBoundaries from './rules/client-boundaries.ts'
import internalBoundaries from './rules/internal-boundaries.ts'
import noInternalLeak from './rules/no-internal-leak.ts'
import noTerminalOutput from './rules/no-terminal-output.ts'
import testColocation from './rules/test-colocation.ts'

export default {
  meta: { name: 'polar-sdk' },
  rules: {
    'client-boundaries': clientBoundaries,
    'internal-boundaries': internalBoundaries,
    'no-internal-leak': noInternalLeak,
    'no-terminal-output': noTerminalOutput,
    'test-colocation': testColocation,
  },
}
