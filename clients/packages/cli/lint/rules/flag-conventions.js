import { inSource, isMember, isTest } from '../ast.js'

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const namespaces = new Set(['Flag', 'Argument'])

const combinators = new Set(['optional', 'atLeast', 'between', 'map'])

const isConstructor = (node) => {
  if (node.type !== 'CallExpression') return false
  const { callee } = node
  if (
    callee.type !== 'MemberExpression' ||
    callee.object.type !== 'Identifier' ||
    !namespaces.has(callee.object.name) ||
    callee.property.type !== 'Identifier'
  ) {
    return false
  }
  const method = callee.property.name
  return (
    !method.startsWith('with') &&
    !combinators.has(method) &&
    node.arguments[0]?.type === 'Literal' &&
    typeof node.arguments[0].value === 'string'
  )
}

const isBoolean = (node) => isMember(node.callee, 'Flag', 'Boolean')

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

const setsFalse = (step) =>
  step.type === 'CallExpression' &&
  isMember(step.callee, 'Flag', 'withDefault') &&
  step.arguments[0]?.type === 'Literal' &&
  step.arguments[0].value === false

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Flag and argument names are kebab-case, and boolean flags default to false so they can be left out and turned on.',
    },
    messages: {
      kebab: '{{namespace}} "{{name}}" must be kebab-case, e.g. "pr-comment".',
      default:
        'Boolean flag "{{name}}" must pipe through Flag.withDefault(false): a boolean that is required, or defaults to true, cannot be left out or turned off.',
    },
  },
  create(context) {
    if (!inSource(context) || isTest(context)) return {}
    const booleans = []
    const defaulted = new Set()
    return {
      CallExpression(node) {
        if (isConstructor(node)) {
          const name = node.arguments[0].value
          if (!KEBAB.test(name)) {
            context.report({
              node,
              messageId: 'kebab',
              data: { namespace: node.callee.object.name, name },
            })
          }
          if (isBoolean(node)) booleans.push(node)
          return
        }
        if (!isPipeCall(node)) return
        const { root, steps } = unwrapPipes(node)
        if (isConstructor(root) && isBoolean(root) && steps.some(setsFalse)) {
          defaulted.add(root)
        }
      },
      'Program:exit'() {
        for (const node of booleans) {
          if (defaulted.has(node)) continue
          context.report({
            node,
            messageId: 'default',
            data: { name: node.arguments[0].value },
          })
        }
      },
    }
  },
}
