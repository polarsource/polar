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

const styled = (text) => /^[A-Z]/.test(text) && !text.endsWith('.')

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every command, flag and argument declares a description, written as a capitalised phrase without a trailing period, so --help is complete and reads as a list.',
    },
    messages: {
      missing:
        '{{kind}} "{{name}}" has no description. Pipe it through {{namespace}}.withDescription so it shows up in --help.',
      style:
        'Descriptions start with a capital letter and end without a period, so --help reads as a list: "Overwrite the file", not "overwrite the file.".',
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
        const namespace = namespaceOf(node.callee)
        const [text] = node.arguments
        if (
          namespace !== undefined &&
          describes(node, namespace) &&
          text?.type === 'Literal' &&
          typeof text.value === 'string' &&
          !styled(text.value)
        ) {
          context.report({ node: text, messageId: 'style' })
          return
        }
        if (!isPipeCall(node)) return
        const { root, steps } = unwrapPipes(node)
        if (!isConstructor(root)) return
        const rootNamespace = namespaceOf(root.callee)
        if (steps.some((step) => describes(step, rootNamespace))) {
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
