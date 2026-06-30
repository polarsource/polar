function getStaticHref(attr) {
  if (
    attr.type !== 'JSXAttribute' ||
    attr.name.type !== 'JSXIdentifier' ||
    attr.name.name !== 'href'
  ) {
    return null
  }

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

function isExternalHref(href) {
  return href.startsWith('http') || href.startsWith('/docs')
}

/** @type {import('eslint').Rule.RuleModule} */
const noExternalLinkComponent = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the next/link <Link /> component for external URLs',
    },
    schema: [],
    messages: {
      noExternalLinkComponent:
        'Use a native <a> element instead of <Link> for external URLs. next/link is for internal navigation only.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'Link') {
          return
        }
        for (const attr of node.attributes) {
          const href = getStaticHref(attr)
          if (href !== null && isExternalHref(href)) {
            context.report({ node: attr, messageId: 'noExternalLinkComponent' })
          }
        }
      },
    }
  },
}

export default noExternalLinkComponent
