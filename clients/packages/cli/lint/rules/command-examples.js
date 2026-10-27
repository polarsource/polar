import { inDirectory, isMember } from '../ast.js'

const isCommandMake = (node) =>
  node.type === 'CallExpression' &&
  isMember(node.callee, 'Command', 'make') &&
  node.arguments[0]?.type === 'Literal' &&
  typeof node.arguments[0].value === 'string'

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

const givesExamples = (step) => {
  if (
    step.type !== 'CallExpression' ||
    !isMember(step.callee, 'Command', 'withExamples')
  ) {
    return false
  }
  const [examples] = step.arguments
  return (
    examples !== undefined &&
    !(examples.type === 'ArrayExpression' && examples.elements.length === 0)
  )
}

const takesInput = (node) => {
  const config = node.arguments[1]
  return (
    config !== undefined &&
    !(config.type === 'ObjectExpression' && config.properties.length === 0)
  )
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A command with flags or arguments shows how to use them in --help, so people and agents can copy a working invocation.',
    },
    messages: {
      missing:
        'Command "{{name}}" takes flags or arguments but shows no examples. Pipe it through Command.withExamples with at least one command and description.',
    },
  },
  create(context) {
    if (!inDirectory(context, 'commands')) return {}
    const commands = []
    const covered = new Set()
    return {
      CallExpression(node) {
        if (isCommandMake(node)) {
          if (takesInput(node)) commands.push(node)
          return
        }
        if (!isPipeCall(node)) return
        const { root, steps } = unwrapPipes(node)
        if (!isCommandMake(root)) return
        if (steps.some(givesExamples)) covered.add(root)
      },
      'Program:exit'() {
        for (const node of commands) {
          if (covered.has(node)) continue
          context.report({
            node,
            messageId: 'missing',
            data: { name: node.arguments[0].value },
          })
        }
      },
    }
  },
}
