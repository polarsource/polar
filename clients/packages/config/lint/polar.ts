import noTerminalOutput from './rules/no-terminal-output.ts'
import schemaIsPure from './rules/schema-is-pure.ts'
import testColocation from './rules/test-colocation.ts'

export default {
  meta: { name: 'polar-config' },
  rules: {
    'no-terminal-output': noTerminalOutput,
    'schema-is-pure': schemaIsPure,
    'test-colocation': testColocation,
  },
}
