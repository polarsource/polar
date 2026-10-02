import {
  areaOf,
  isTestFile,
  locate,
  resolveImport,
  sourceOf,
} from '../paths.ts'
import type { Node, Rule } from '../types.ts'

type Reported = Node<'ExportSpecifier'> | Node<'ExportDefaultDeclaration'>

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Nothing under src/internal is part of the public API, so no file outside it may re-export from it.',
    },
    messages: {
      leak: 'Do not re-export from internal/. Anything a consumer can import must live in a public folder.',
    },
  },
  create(context) {
    const file = locate(context)
    if (file === undefined || isTestFile(file) || areaOf(file) === 'internal') {
      return {}
    }
    const internalBindings = new Set<string>()
    const exportedBindings: { node: Reported; name: string }[] = []

    const isInternal = (node: Parameters<typeof sourceOf>[0]) => {
      const source = sourceOf(node)
      const target =
        source === undefined ? undefined : resolveImport(file, source)
      return target !== undefined && areaOf(target) === 'internal'
    }

    return {
      ImportDeclaration(node) {
        if (!isInternal(node)) return
        for (const specifier of node.specifiers) {
          internalBindings.add(specifier.local.name)
        }
      },
      ExportAllDeclaration(node) {
        if (isInternal(node)) context.report({ node, messageId: 'leak' })
      },
      ExportNamedDeclaration(node) {
        if (isInternal(node)) {
          context.report({ node, messageId: 'leak' })
        } else if (node.source === null) {
          for (const specifier of node.specifiers) {
            if (specifier.local.type === 'Identifier') {
              exportedBindings.push({
                node: specifier,
                name: specifier.local.name,
              })
            }
          }
        }
      },
      ExportDefaultDeclaration(node) {
        if (node.declaration.type === 'Identifier') {
          exportedBindings.push({ node, name: node.declaration.name })
        }
      },
      'Program:exit'() {
        for (const { node, name } of exportedBindings) {
          if (internalBindings.has(name)) {
            context.report({ node, messageId: 'leak' })
          }
        }
      },
    }
  },
} satisfies Rule
