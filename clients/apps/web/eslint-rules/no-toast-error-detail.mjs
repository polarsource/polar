const TEXT_PROPERTIES = new Set(['title', 'description'])

function isSafeToastType(type, checker) {
  if (type.isUnion()) {
    return type.types.every((t) => isSafeToastType(t, checker))
  }
  const flags = type.getFlags()

  // String=4, StringLiteral=128, TemplateLiteral=134217728,
  // Null=65536, Undefined=32768, Void=16384
  return (flags & (4 | 128 | 134217728 | 65536 | 32768 | 16384)) !== 0
}

function collectExpressions(node) {
  if (!node) return []

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return []
  }

  if (node.type === 'TemplateLiteral') {
    return node.expressions.flatMap(collectExpressions)
  }

  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return [...collectExpressions(node.left), ...collectExpressions(node.right)]
  }

  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    return []
  }

  return [node]
}

function containsDetailAccess(node) {
  if (!node) return false
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === 'detail'
  ) {
    return true
  }
  if (node.type === 'TemplateLiteral') {
    return node.expressions.some((expr) => containsDetailAccess(expr))
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return containsDetailAccess(node.left) || containsDetailAccess(node.right)
  }
  if (node.type === 'ChainExpression') {
    return containsDetailAccess(node.expression)
  }
  if (node.type === 'LogicalExpression') {
    return containsDetailAccess(node.left) || containsDetailAccess(node.right)
  }
  if (node.type === 'ConditionalExpression') {
    return (
      containsDetailAccess(node.test) ||
      containsDetailAccess(node.consequent) ||
      containsDetailAccess(node.alternate)
    )
  }
  return false
}

/** @type {import('eslint').Rule.RuleModule} */
const noToastErrorDetail = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow non-string expressions in toast title and description',
      requiresTypeChecking: true,
    },
    schema: [],
    messages: {
      nonStringInToast:
        'Expression of type `{{ type }}` in toast {{ property }} may render as [object Object]. Use extractApiErrorMessage(error) from @/utils/api/errors for error objects, or ensure the value is a string.',
      noDetailInToast:
        'This shape is unpredictable and may render as [object Object]. Use extractApiErrorMessage(error) from @/utils/api/errors instead.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices
    const hasTypeInfo =
      services && services.program && services.esTreeNodeToTSNodeMap

    const checker = hasTypeInfo ? services.program.getTypeChecker() : null

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'toast') {
          return
        }

        const arg = node.arguments[0]
        if (!arg || arg.type !== 'ObjectExpression') return

        for (const prop of arg.properties) {
          if (prop.type !== 'Property') continue

          const key = prop.key
          const keyName =
            key.type === 'Identifier'
              ? key.name
              : key.type === 'Literal'
                ? key.value
                : null
          if (!keyName || !TEXT_PROPERTIES.has(keyName)) continue

          if (checker) {
            const expressions = collectExpressions(prop.value)
            for (const expr of expressions) {
              const tsNode = services.esTreeNodeToTSNodeMap.get(expr)
              if (!tsNode) continue
              const type = checker.getTypeAtLocation(tsNode)
              if (!isSafeToastType(type, checker)) {
                context.report({
                  node: expr,
                  messageId: 'nonStringInToast',
                  data: {
                    type: checker.typeToString(type),
                    property: keyName,
                  },
                })
              }
            }
          } else {
            if (containsDetailAccess(prop.value)) {
              context.report({
                node: prop.value,
                messageId: 'noDetailInToast',
              })
            }
          }
        }
      },
    }
  },
}

export default noToastErrorDetail
