const TEXT_PROPERTIES = new Set(['title', 'description'])

function getPropertyName(property) {
  if (property.type === 'Identifier') {
    return property.name
  }
  if (property.type === 'Literal' && typeof property.value === 'string') {
    return property.value
  }
  return null
}

function isDetailAccess(node) {
  if (node.type !== 'MemberExpression') {
    return false
  }
  if (!node.computed) {
    return (
      node.property.type === 'Identifier' && node.property.name === 'detail'
    )
  }
  return node.property.type === 'Literal' && node.property.value === 'detail'
}

function findDetailAccess(node, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) {
    return null
  }
  seen.add(node)

  if (isDetailAccess(node)) {
    return node
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') {
      continue
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        const detailAccess = findDetailAccess(child, seen)
        if (detailAccess) {
          return detailAccess
        }
      }
    } else {
      const detailAccess = findDetailAccess(value, seen)
      if (detailAccess) {
        return detailAccess
      }
    }
  }

  return null
}

const noUnsanitizedToastDetail = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unsanitized error details in toast text',
    },
    schema: [],
    messages: {
      unsanitizedDetail:
        'Do not use .detail directly in a toast {{property}}. Use extractApiErrorMessage(error) from @/utils/api/errors.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'toast') {
          return
        }

        const argument = node.arguments[0]
        if (!argument || argument.type !== 'ObjectExpression') {
          return
        }

        for (const property of argument.properties) {
          if (property.type !== 'Property') {
            continue
          }

          const propertyName = getPropertyName(property.key)
          if (!propertyName || !TEXT_PROPERTIES.has(propertyName)) {
            continue
          }

          const detailAccess = findDetailAccess(property.value)
          if (detailAccess) {
            context.report({
              node: detailAccess,
              messageId: 'unsanitizedDetail',
              data: { property: propertyName },
            })
          }
        }
      },
    }
  },
}

export default noUnsanitizedToastDetail
