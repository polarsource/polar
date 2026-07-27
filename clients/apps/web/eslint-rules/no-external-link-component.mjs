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
  return /^https?:\/\//.test(href) || href.startsWith('/docs')
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
    const nextLinkLocalNames = new Set()

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'next/link') return
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier') {
            nextLinkLocalNames.add(specifier.local.name)
          }
        }
      },
      JSXOpeningElement(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          !nextLinkLocalNames.has(node.name.name)
        ) {
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
