function getStaticAttrValue(attr) {
  const { value } = attr

  if (value?.type === 'Literal' && typeof value.value === 'string') {
    return value.value
  }

  if (value?.type === 'JSXExpressionContainer') {
    const { expression } = value
    if (expression.type === 'Literal' && typeof expression.value === 'string') {
      return expression.value
    }
    if (
      expression.type === 'TemplateLiteral' &&
      expression.expressions.length === 0
    ) {
      return expression.quasis[0].value.cooked
    }
  }

  return null
}

function findAttr(node, name) {
  return node.attributes.find(
    (attr) =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === name,
  )
}

function isExternalHref(href) {
  return href.startsWith('http') || href.startsWith('/docs')
}

/** @type {import('eslint').Rule.RuleModule} */
const requireExternalLinkRel = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require rel="noopener noreferrer" on external <a> links',
    },
    schema: [],
    messages: {
      requireExternalLinkRel:
        'External <a> links must set rel="noopener noreferrer".',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'a') {
          return
        }

        const hrefAttr = findAttr(node, 'href')
        if (!hrefAttr) return

        const href = getStaticAttrValue(hrefAttr)
        if (href === null || !isExternalHref(href)) return

        const relAttr = findAttr(node, 'rel')
        const rel = relAttr ? getStaticAttrValue(relAttr) : null
        const tokens = rel ? rel.split(/\s+/) : []

        if (!tokens.includes('noopener') || !tokens.includes('noreferrer')) {
          context.report({
            node: relAttr ?? node,
            messageId: 'requireExternalLinkRel',
          })
        }
      },
    }
  },
}

export default requireExternalLinkRel
