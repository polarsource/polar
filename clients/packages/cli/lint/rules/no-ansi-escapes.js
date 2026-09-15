import { isFile } from '../ast.js'

const ansi = new RegExp(`${String.fromCharCode(27)}\\[`)

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Terminal styling goes through utils/ui.' },
    messages: {
      ansi: 'Do not hand-write ANSI escape codes. Use the helpers in utils/ui.',
    },
  },
  create(context) {
    if (isFile(context, 'utils/ui.ts')) return {}
    return {
      Literal(node) {
        if (typeof node.value === 'string' && ansi.test(node.value)) {
          context.report({ node, messageId: 'ansi' })
        }
      },
      TemplateElement(node) {
        if (ansi.test(node.value.cooked ?? node.value.raw)) {
          context.report({ node, messageId: 'ansi' })
        }
      },
    }
  },
}
