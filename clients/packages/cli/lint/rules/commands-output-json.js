import {
  BUILDERS_MODULE,
  commandBindings,
  inDirectory,
  isCommandMake,
  isMember,
} from '../ast.js'

const printers = new Set(['Console', 'printJson'])

const isGlobalOutput = (callee) =>
  isMember(callee, 'console') ||
  (callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'write' &&
    (isMember(callee.object, 'process', 'stdout') ||
      isMember(callee.object, 'process', 'stderr')))

const isWithHandler = (callee, bindings) =>
  [...bindings].some(
    (name) =>
      isMember(callee, name, 'withHandler') ||
      (callee.type === 'MemberExpression' &&
        isMember(callee.object, name, 'Command') &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'withHandler'),
  )

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every command supports --json. A command gets its handler from output() or streaming() in utils/command, which own the flag and all printing; commands never print themselves.',
    },
    messages: {
      inlineHandler: `Do not pass a handler to Command.make. Pipe the command through output() or streaming() from ${BUILDERS_MODULE} so it gets --json.`,
      withHandler: `Do not call Command.withHandler directly. Pipe through output() or streaming() from ${BUILDERS_MODULE}.`,
      print:
        'Commands do not print. Return the result from run() and describe it in render(); output() prints it or emits JSON.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'commands')) return {}
    const bindings = new Set()
    return {
      ImportDeclaration(node) {
        for (const name of commandBindings(node)) bindings.add(name)
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            printers.has(specifier.imported.name)
          ) {
            context.report({ node: specifier, messageId: 'print' })
          }
        }
      },
      CallExpression(node) {
        const { callee } = node
        if (isCommandMake(node, bindings) && node.arguments.length > 2) {
          context.report({ node, messageId: 'inlineHandler' })
        }
        if (isWithHandler(callee, bindings)) {
          context.report({ node, messageId: 'withHandler' })
        }
        if (isGlobalOutput(callee)) context.report({ node, messageId: 'print' })
      },
    }
  },
}
