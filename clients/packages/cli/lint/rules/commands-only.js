import { commandBindings, inDirectory, isCommandMake } from '../ast.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every module in src/commands defines a command with Command.make. Shared flags, parsers and renderers live in src/utils.',
    },
    messages: {
      notACommand:
        'This file is in src/commands but does not define a command. Move it to src/utils (or src/services if it talks to the API).',
    },
  },
  create(context) {
    if (!inDirectory(context, 'commands')) return {}
    const bindings = new Set()
    let defined = false
    return {
      ImportDeclaration(node) {
        for (const name of commandBindings(node)) bindings.add(name)
      },
      CallExpression(node) {
        if (isCommandMake(node, bindings)) defined = true
      },
      'Program:exit'(node) {
        if (!defined) context.report({ node, messageId: 'notACommand' })
      },
    }
  },
}
