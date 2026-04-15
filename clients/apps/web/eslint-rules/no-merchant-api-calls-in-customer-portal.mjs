const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const MERCHANT_PATH_PREFIX = '/v1/'
const CUSTOMER_PORTAL_PATH_PREFIX = '/v1/customer-portal/'

function isMerchantPath(path) {
  return (
    path.startsWith(MERCHANT_PATH_PREFIX) &&
    !path.startsWith(CUSTOMER_PORTAL_PATH_PREFIX)
  )
}

function getStaticPathPrefix(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node.type === 'TemplateLiteral' && node.quasis.length > 0) {
    return node.quasis[0].value.cooked ?? ''
  }
  return null
}

/** @type {import('eslint').Rule.RuleModule} */
const noMerchantApiCallsInCustomerPortal = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct merchant API calls in customer portal code',
    },
    schema: [],
    messages: {
      merchantApiCall:
        'Direct merchant API call to "{{path}}" in customer portal code. Customer portal must only call /v1/customer-portal/* endpoints — merchant endpoints 401/403 for customers.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression') return
        if (callee.computed) return
        if (callee.property.type !== 'Identifier') return
        if (!HTTP_METHODS.has(callee.property.name)) return

        const firstArg = node.arguments[0]
        if (!firstArg) return

        const prefix = getStaticPathPrefix(firstArg)
        if (prefix === null) return

        if (isMerchantPath(prefix)) {
          context.report({
            node: firstArg,
            messageId: 'merchantApiCall',
            data: { path: prefix },
          })
        }
      },
    }
  },
}

export default noMerchantApiCallsInCustomerPortal
