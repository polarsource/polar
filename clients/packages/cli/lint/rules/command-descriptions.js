import { inDirectory } from '../ast.js'

const namespaces = new Set(['Command', 'Flag', 'Argument'])

const namespaceOf = (callee) =>
  callee.type === 'MemberExpression' &&
  callee.object.type === 'Identifier' &&
  namespaces.has(callee.object.name) &&
  callee.property.type === 'Identifier'
    ? callee.object.name
    : undefined

const combinators = new Set(['optional', 'atLeast', 'between', 'map'])

const isConstructor = (node) => {
  if (node.type !== 'CallExpression') return false
  const namespace = namespaceOf(node.callee)
  if (namespace === undefined) return false
  const method = node.callee.property.name
  const constructs =
    namespace === 'Command'
      ? method === 'make'
      : !method.startsWith('with') && !combinators.has(method)
  return (
    constructs &&
    node.arguments[0]?.type === 'Literal' &&
    typeof node.arguments[0].value === 'string'
  )
}

const isPipeCall = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'pipe'

const unwrapPipes = (node) => {
  const steps = []
  let current = node
  while (isPipeCall(current)) {
    steps.push(...current.arguments)
    current = current.callee.object
  }
  return { root: current, steps }
}

const describes = (combinator, namespace) =>
  combinator.type === 'CallExpression' &&
  namespaceOf(combinator.callee) === namespace &&
  combinator.callee.property.name === 'withDescription'

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every command, flag and argument declares a description so --help is complete.',
    },
    messages: {
      missing:
        '{{kind}} "{{name}}" has no description. Pipe it through {{namespace}}.withDescription so it shows up in --help.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'commands')) return {}
    const described = new Set()
    const constructors = []
    return {
      CallExpression(node) {
        if (isConstructor(node)) {
          constructors.push(node)
          return
        }
        if (!isPipeCall(node)) return
        const { root, steps } = unwrapPipes(node)
        if (!isConstructor(root)) return
        const namespace = namespaceOf(root.callee)
        if (steps.some((step) => describes(step, namespace))) {
          described.add(root)
        }
      },
      'Program:exit'() {
        for (const node of constructors) {
          if (described.has(node)) continue
          const namespace = namespaceOf(node.callee)
          context.report({
            node,
            messageId: 'missing',
            data: {
              kind: namespace === 'Command' ? 'Command' : namespace,
              name: node.arguments[0].value,
              namespace,
            },
          })
        }
      },
    }
  },
}
