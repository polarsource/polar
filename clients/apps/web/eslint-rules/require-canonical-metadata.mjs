const MARKETING_PATH_SEGMENT = '/(website)/'

function isMarketingFile(context) {
  const filename = context.filename ?? context.getFilename?.() ?? ''
  return filename.includes(MARKETING_PATH_SEGMENT)
}

function isCanonicalKey(key) {
  if (!key) return false
  if (key.type === 'Identifier') return key.name === 'canonical'
  if (key.type === 'Literal') return key.value === 'canonical'
  return false
}

/** @type {import('eslint').Rule.RuleModule} */
const requireCanonicalMetadata = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require public marketing pages that export metadata to declare a canonical URL (via buildMetadata or alternates.canonical).',
    },
    schema: [],
    messages: {
      missingCanonical:
        'This marketing page exports metadata but never sets a canonical URL. Use buildMetadata({ path, ... }) from @/utils/metadata, or set alternates.canonical — otherwise the page inherits the homepage canonical and is dropped from search.',
    },
  },
  create(context) {
    if (!isMarketingFile(context)) return {}

    let metadataExport = null
    let hasCanonical = false

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration
        if (!decl) return

        if (decl.type === 'VariableDeclaration') {
          const declaresMetadata = decl.declarations.some(
            (d) => d.id.type === 'Identifier' && d.id.name === 'metadata',
          )
          if (declaresMetadata) metadataExport = node
        } else if (
          (decl.type === 'FunctionDeclaration' ||
            decl.type === 'TSDeclareFunction') &&
          decl.id?.name === 'generateMetadata'
        ) {
          metadataExport = node
        }
      },
      Property(node) {
        if (isCanonicalKey(node.key)) hasCanonical = true
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'buildMetadata'
        ) {
          hasCanonical = true
        }
      },
      'Program:exit'() {
        if (metadataExport && !hasCanonical) {
          context.report({
            node: metadataExport,
            messageId: 'missingCanonical',
          })
        }
      },
    }
  },
}

export default requireCanonicalMetadata
