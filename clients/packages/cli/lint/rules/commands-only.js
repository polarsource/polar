import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { commandBindings, inDirectory, isCommandMake } from '../ast.js'

const insideCommand = (filename) => {
  const entry = join(dirname(filename), 'index.ts')
  return (
    filename !== entry &&
    existsSync(entry) &&
    !readFileSync(entry, 'utf8').includes('withSubcommands')
  )
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every module in src/commands defines a command with Command.make. A command split into a directory defines it in index.ts and keeps its own modules next to it. Shared flags, parsers and renderers live in src/utils.',
    },
    messages: {
      notACommand:
        'This file is in src/commands but does not define a command. Move it to src/utils (or src/services if it talks to the API), or next to the index.ts of the command it belongs to.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'commands')) return {}
    if (insideCommand(context.filename ?? context.getFilename())) return {}
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
