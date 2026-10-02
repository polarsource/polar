import {
  areaOf,
  isTestFile,
  locate,
  resolveImport,
  sourceOf,
} from '../paths.ts'
import type { Rule } from '../types.ts'

const PUBLIC_AREAS = ['client', 'adapters', 'plugins', 'testing']

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A file in src/internal does the work and returns data. It must not depend on the public folders; they call it, not the other way round.',
    },
    messages: {
      public:
        'internal/ must not depend on {{target}}/. Move the shared code into internal/ or schema/.',
    },
  },
  create(context) {
    const file = locate(context)
    if (file === undefined || isTestFile(file) || areaOf(file) !== 'internal') {
      return {}
    }
    const check = (node: Parameters<typeof sourceOf>[0]) => {
      const source = sourceOf(node)
      const target =
        source === undefined ? undefined : resolveImport(file, source)
      if (target === undefined) return
      const targetArea = areaOf(target)
      if (PUBLIC_AREAS.includes(targetArea)) {
        context.report({
          node,
          messageId: 'public',
          data: { target: targetArea },
        })
      }
    }
    return {
      ImportDeclaration: check,
      ImportExpression: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
    }
  },
} satisfies Rule
