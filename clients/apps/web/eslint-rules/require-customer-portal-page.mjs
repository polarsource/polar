/** @type {import('eslint').Rule.RuleModule} */
const requireCustomerPortalPage = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require authenticated customer portal pages to render their content inside <CustomerPortalPage>.',
    },
    schema: [],
    messages: {
      missing:
        'This customer portal page must render its content inside <CustomerPortalPage>. If this page is intentionally standalone (e.g. an unauthenticated request/authenticate page), add it to the rule ignores in eslint.config.mjs.',
    },
  },
  create(context) {
    let rendersCustomerPortalPage = false

    return {
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          node.name.name === 'CustomerPortalPage'
        ) {
          rendersCustomerPortalPage = true
        }
      },
      'Program:exit'(node) {
        if (!rendersCustomerPortalPage) {
          context.report({ node, messageId: 'missing' })
        }
      },
    }
  },
}

export default requireCustomerPortalPage
