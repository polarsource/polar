const PATTERN_NODES = new Set([
  'ObjectPattern',
  'ArrayPattern',
  'Property',
  'AssignmentPattern',
  'RestElement',
])

function isFormState(key, computed) {
  if (!computed && key.type === 'Identifier') {
    return key.name === 'formState'
  }
  return key.type === 'Literal' && key.value === 'formState'
}

function isDeclaredVariable(pattern) {
  let node = pattern
  while (node && PATTERN_NODES.has(node.type)) {
    node = node.parent
  }
  return Boolean(node) && node.type === 'VariableDeclarator'
}

const noFormStateRead = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow reading react-hook-form formState directly; subscribe with useFormState',
    },
    schema: [],
    messages: {
      formStateRead:
        'formState read without a subscription is not reactive under the React Compiler. Use useFormState({ control }) instead.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isFormState(node.property, node.computed)) {
          context.report({ node, messageId: 'formStateRead' })
        }
      },
      Property(node) {
        if (
          node.parent.type === 'ObjectPattern' &&
          isFormState(node.key, node.computed) &&
          isDeclaredVariable(node.parent)
        ) {
          context.report({ node, messageId: 'formStateRead' })
        }
      },
    }
  },
}

export default noFormStateRead
