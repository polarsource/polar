import ts from 'typescript'

const TEXT_PROPERTIES = new Set(['title', 'description'])
const SAFE_TYPE_FLAGS =
  ts.TypeFlags.StringLike |
  ts.TypeFlags.Null |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Void

function isSafeToastType(type) {
  if (type.isUnion()) {
    return type.types.every(isSafeToastType)
  }
  return (type.getFlags() & SAFE_TYPE_FLAGS) !== 0
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
              if (!isSafeToastType(type)) {
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
          }
        }
      },
    }
  },
}

export default noToastErrorDetail
