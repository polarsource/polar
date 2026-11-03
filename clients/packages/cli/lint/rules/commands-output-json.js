import {
  BUILDERS_MODULE,
  commandBindings,
  inDirectory,
  isCommandMake,
  isFile,
  isMember,
} from '../ast.js'

// Paths under src/, e.g. 'commands/auth/token.ts'
const TEXT_ONLY = ['commands/token.ts']

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
        'A command gets its handler from output(), streaming() or textOnly() in utils/command, which own --json and all printing; commands never print themselves. Only textOnly() commands opt out of --json, and they refuse it.',
    },
    messages: {
      inlineHandler: `Do not pass a handler to Command.make. Pipe the command through output() or streaming() from ${BUILDERS_MODULE} so it gets --json, or textOnly() when JSON makes no sense for it.`,
      withHandler: `Do not call Command.withHandler directly. Pipe through output(), streaming() or textOnly() from ${BUILDERS_MODULE}.`,
      textOnly:
        'Use output() so the command supports --json. textOnly() is only for commands where JSON makes no sense; add the file to TEXT_ONLY in lint/rules/commands-output-json.js.',
      print:
        'Commands do not print. Return the result from run() and describe it in render(); output() prints it or emits JSON.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'commands')) return {}
    const bindings = new Set()
    const textOnly = new Set()
    const builders = new Set()
    const allowed = isFile(context, ...TEXT_ONLY)
    return {
      ImportDeclaration(node) {
        for (const name of commandBindings(node)) bindings.add(name)
        if (node.source.value === BUILDERS_MODULE) {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'textOnly'
            ) {
              textOnly.add(specifier.local.name)
            }
            if (specifier.type === 'ImportNamespaceSpecifier') {
              builders.add(specifier.local.name)
            }
          }
        }
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
        if (
          !allowed &&
          ((callee.type === 'Identifier' && textOnly.has(callee.name)) ||
            [...builders].some((name) => isMember(callee, name, 'textOnly')))
        ) {
          context.report({ node, messageId: 'textOnly' })
        }
      },
    }
  },
}
