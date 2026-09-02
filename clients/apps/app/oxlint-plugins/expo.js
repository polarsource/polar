const noDynamicEnvVar = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unexpectedDynamicAccess:
        'Unexpected dynamic access. Cannot dynamically access {{value}} from process.env',
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        const init = node.init
        const isProcessEnv =
          init?.type === 'MemberExpression' &&
          init.object.type === 'MemberExpression' &&
          init.object.object.type === 'Identifier' &&
          init.object.object.name === 'process' &&
          init.object.property.type === 'Identifier' &&
          init.object.property.name === 'env'

        if (!isProcessEnv || !init.computed) return

        const value =
          init.property.type === 'Identifier'
            ? init.property.name
            : init.property.type === 'Literal'
              ? init.property.value
              : ''
        context.report({
          node,
          messageId: 'unexpectedDynamicAccess',
          data: { value },
        })
      },
    }
  },
}

const noEnvVarDestructuring = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unexpectedDestructuring:
        'Unexpected destructuring. Cannot destructure {{value}} from process.env',
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        const isProcessEnv =
          node.init?.type === 'MemberExpression' &&
          node.init.object.type === 'Identifier' &&
          node.init.object.name === 'process' &&
          node.init.property.type === 'Identifier' &&
          node.init.property.name === 'env'
        if (node.id.type !== 'ObjectPattern' || !isProcessEnv) return

        for (const property of node.id.properties) {
          const value =
            property.type === 'Property' && property.value.type === 'Identifier'
              ? property.value.name
              : 'variables'
          context.report({
            node,
            messageId: 'unexpectedDestructuring',
            data: { value },
          })
        }
      },
    }
  },
}

const useDomExports = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      noOtherExports:
        'Files with the "use dom" directive may not contain named exports or other default exports.',
      asyncDefaultExport: 'The default export must not be an async function.',
      invalidDefaultExport: 'The default export must be a function.',
      missingDefaultExport:
        'Files with the "use dom" directive must export a React component as the default export.',
    },
  },
  create(context) {
    return {
      Program(node) {
        let isDomComponent = false
        let hasDefaultExport = false

        for (const statement of node.body) {
          if (
            statement.type === 'ExpressionStatement' &&
            statement.expression.type === 'Literal' &&
            statement.expression.value === 'use dom'
          ) {
            isDomComponent = true
          }
          if (!isDomComponent) continue

          if (
            statement.type === 'ExportNamedDeclaration' &&
            (!statement.declaration ||
              ![
                'TSInterfaceDeclaration',
                'TSTypeAliasDeclaration',
                'TSModuleDeclaration',
              ].includes(statement.declaration.type))
          ) {
            const exportsDefault = statement.specifiers.some(
              (specifier) =>
                specifier.type === 'ExportSpecifier' &&
                specifier.exported.type === 'Identifier' &&
                specifier.exported.name === 'default',
            )
            if (
              !exportsDefault ||
              hasDefaultExport ||
              statement.specifiers.length > 1
            ) {
              context.report({ node: statement, messageId: 'noOtherExports' })
            }
            if (exportsDefault) hasDefaultExport = true
          }

          if (statement.type === 'ExportDefaultDeclaration') {
            if (hasDefaultExport) {
              context.report({ node: statement, messageId: 'noOtherExports' })
              continue
            }
            hasDefaultExport = true
            const declaration = statement.declaration
            if (declaration.type === 'Identifier') continue
            if (
              ![
                'FunctionDeclaration',
                'ArrowFunctionExpression',
                'FunctionExpression',
              ].includes(declaration.type)
            ) {
              context.report({
                node: statement,
                messageId: 'invalidDefaultExport',
              })
            } else if (declaration.async) {
              context.report({
                node: statement,
                messageId: 'asyncDefaultExport',
              })
            }
          }

          if (
            statement.type === 'ExportAllDeclaration' &&
            statement.exported?.name === 'default'
          ) {
            if (hasDefaultExport) {
              context.report({ node: statement, messageId: 'noOtherExports' })
            }
            hasDefaultExport = true
          }
        }

        if (isDomComponent && !hasDefaultExport) {
          context.report({ node, messageId: 'missingDefaultExport' })
        }
      },
    }
  },
}

module.exports = {
  rules: {
    'no-dynamic-env-var': noDynamicEnvVar,
    'no-env-var-destructuring': noEnvVarDestructuring,
    'use-dom-exports': useDomExports,
  },
}
