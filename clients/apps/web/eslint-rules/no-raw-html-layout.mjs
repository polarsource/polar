const BANNED_ELEMENTS = new Set([
  'div',
  'span',
  'section',
  'article',
  'main',
  'aside',
  'nav',
  'header',
  'footer',
  'form',
  'fieldset',
  'label',
  'ul',
  'ol',
  'li',
])

/** @type {import('eslint').Rule.RuleModule} */
const noRawHtmlLayout = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw HTML layout elements in favor of <Box /> from @polar-sh/orbit',
    },
    schema: [],
    messages: {
      noRawElement:
        'Use <Box /> from @polar-sh/orbit instead of <{{ element }} />. This ensures we follow the Orbit design system.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return
        if (!BANNED_ELEMENTS.has(node.name.name)) return
        context.report({
          node,
          messageId: 'noRawElement',
          data: { element: node.name.name },
        })
      },
    }
  },
}

export default noRawHtmlLayout
