import { isGlobal } from '../ast.ts'
import {
  areaOf,
  isTestFile,
  locate,
  resolveImport,
  sourceOf,
} from '../paths.ts'
import type { Rule } from '../types.ts'

const API_MODULES = ['index', 'index.ts']

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A file in src/client defines what the customer calls. It must not talk to the Polar API or to storage itself; it calls internal and uses the adapter it was given.',
    },
    messages: {
      api: 'client/ must not call the Polar API directly. Add or use a function in internal/api.',
      fetch:
        'client/ must not make HTTP requests. Add or use a function in internal/api.',
      adapter:
        'client/ must not import an adapter. The storage adapter arrives through connect().',
    },
  },
  create(context) {
    const file = locate(context)
    if (file === undefined || isTestFile(file) || areaOf(file) !== 'client') {
      return {}
    }
    const check = (node: Parameters<typeof sourceOf>[0]) => {
      const source = sourceOf(node)
      const target =
        source === undefined ? undefined : resolveImport(file, source)
      if (target === undefined) return
      if (API_MODULES.includes(target)) {
        context.report({ node, messageId: 'api' })
      } else if (areaOf(target) === 'adapters') {
        context.report({ node, messageId: 'adapter' })
      }
    }
    return {
      ImportDeclaration: check,
      ImportExpression: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      CallExpression(node) {
        if (isGlobal(node.callee, 'fetch'))
          context.report({ node, messageId: 'fetch' })
      },
    }
  },
} satisfies Rule
