import { locate, resolveImport, sourceOf } from '../paths.ts'
import type { Node, Rule } from '../types.ts'

const TEST_SUFFIX = '.test.ts'

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A test file sits next to the module it covers and is named after it.',
    },
    messages: {
      subject:
        'This test does not import "./{{name}}". Name test files after the module they cover and keep them next to it.',
    },
  },
  create(context) {
    const file = locate(context)
    if (file === undefined || !file.endsWith(TEST_SUFFIX)) return {}
    const subject = file.slice(0, -TEST_SUFFIX.length)
    let found = false
    const check = (
      node: Node<'ImportDeclaration'> | Node<'ImportExpression'>,
    ) => {
      const source = sourceOf(node)
      const target =
        source === undefined ? undefined : resolveImport(file, source)
      if (target === subject || target === `${subject}.ts`) found = true
    }
    return {
      ImportDeclaration: check,
      ImportExpression: check,
      'Program:exit'(node) {
        if (!found) {
          context.report({
            node,
            messageId: 'subject',
            data: { name: subject.split('/').at(-1) ?? subject },
          })
        }
      },
    }
  },
} satisfies Rule
