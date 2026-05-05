const ORBIT_TEXT_SOURCES = new Set(['@polar-sh/orbit', '@polar-sh/orbit/Text'])

/** @type {import('eslint').Rule.RuleModule} */
const noStyleText = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the `style` prop on `<Text />` from `@polar-sh/orbit`',
    },
    schema: [],
    messages: {
      noStyle:
        'Do not use style on the <Text /> component. Use the available props instead or wrap it in a <Box />.',
    },
  },
  create(context) {
    const orbitTextLocals = new Set()
    const orbitNamespaces = new Set()

    return {
      ImportDeclaration(node) {
        const src = node.source.value
        if (typeof src !== 'string' || !ORBIT_TEXT_SOURCES.has(src)) {
          return
        }
        for (const spec of node.specifiers) {
          if (
            spec.type === 'ImportSpecifier' &&
            spec.imported.type === 'Identifier' &&
            spec.imported.name === 'Text'
          ) {
            orbitTextLocals.add(spec.local.name)
          }
          if (spec.type === 'ImportNamespaceSpecifier') {
            orbitNamespaces.add(spec.local.name)
          }
        }
      },
      JSXOpeningElement(node) {
        const { name } = node
        const isOrbitText =
          (name.type === 'JSXIdentifier' && orbitTextLocals.has(name.name)) ||
          (name.type === 'JSXMemberExpression' &&
            name.object.type === 'JSXIdentifier' &&
            name.property.type === 'JSXIdentifier' &&
            name.property.name === 'Text' &&
            orbitNamespaces.has(name.object.name))

        if (!isOrbitText) {
          return
        }

        for (const attr of node.attributes) {
          if (
            attr.type === 'JSXAttribute' &&
            attr.name.type === 'JSXIdentifier' &&
            attr.name.name === 'style'
          ) {
            context.report({ node: attr, messageId: 'noStyle' })
          }
        }
      },
    }
  },
}

export default noStyleText
