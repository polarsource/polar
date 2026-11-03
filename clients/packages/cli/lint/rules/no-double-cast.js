import { isTest } from '../ast.js'

const escapes = new Set(['TSUnknownKeyword', 'TSAnyKeyword'])

const isCast = (node) =>
  node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion'

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A value is never cast through unknown or any to reach another type; decode it with a schema or fix the type.',
    },
    messages: {
      doubleCast:
        'Do not cast through unknown or any. Decode the value with Schema, narrow it with a type guard, or fix the type at its source.',
    },
  },
  create(context) {
    if (isTest(context)) return {}
    const check = (node) => {
      if (
        isCast(node.expression) &&
        escapes.has(node.expression.typeAnnotation.type)
      ) {
        context.report({ node, messageId: 'doubleCast' })
      }
    }
    return { TSAsExpression: check, TSTypeAssertion: check }
  },
}
