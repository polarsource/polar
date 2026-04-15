const MERCHANT_BARREL = '@/hooks/queries'
const CUSTOMER_PORTAL_PREFIX = '@/hooks/queries/customerPortal'

function isCustomerPortalImport(source) {
  return (
    source === CUSTOMER_PORTAL_PREFIX ||
    source.startsWith(`${CUSTOMER_PORTAL_PREFIX}/`)
  )
}

/** @type {import('eslint').Rule.RuleModule} */
const noMerchantQueriesInCustomerPortal = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow merchant-scoped query imports and re-exports in customer portal code',
    },
    schema: [],
    messages: {
      barrel: 'Customer portal code must use @/hooks/queries/customerPortal.',
      merchantModule:
        'Customer portal code must use @/hooks/queries/customerPortal. Other @/hooks/queries modules are merchant-scoped.',
    },
  },
  create(context) {
    function check(sourceNode) {
      if (!sourceNode) return
      if (sourceNode.type !== 'Literal') return
      const source = sourceNode.value
      if (typeof source !== 'string') return

      if (source === MERCHANT_BARREL) {
        context.report({ node: sourceNode, messageId: 'barrel' })
        return
      }

      if (
        source.startsWith(`${MERCHANT_BARREL}/`) &&
        !isCustomerPortalImport(source)
      ) {
        context.report({ node: sourceNode, messageId: 'merchantModule' })
      }
    }
    return {
      ImportDeclaration(node) {
        check(node.source)
      },
      ExportNamedDeclaration(node) {
        check(node.source)
      },
      ExportAllDeclaration(node) {
        check(node.source)
      },
    }
  },
}

export default noMerchantQueriesInCustomerPortal
