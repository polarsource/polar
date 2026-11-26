import schemaIsPure from './rules/schema-is-pure.ts'
import testColocation from './rules/test-colocation.ts'

export default {
  meta: { name: 'polar-config' },
  rules: {
    'schema-is-pure': schemaIsPure,
    'test-colocation': testColocation,
  },
}
