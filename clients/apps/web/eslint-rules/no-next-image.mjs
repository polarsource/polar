/** @type {import('eslint').Rule.RuleModule} */
const noNextImage = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow imports and re-exports from next/image',
    },
    schema: [],
    messages: {
      noNextImage:
        'Use <StaticImage /> from @/components/Image/StaticImage instead of next/image.',
    },
  },
  create(context) {
    function check(sourceNode) {
      if (!sourceNode) return
      if (sourceNode.type !== 'Literal') return
      if (sourceNode.value !== 'next/image') return
      context.report({ node: sourceNode, messageId: 'noNextImage' })
    }
    return {
      ImportDeclaration(node) {
        check(node.source)
      },
      ExportNamedDeclaration(node) {
        // `export { x }` has no source; `export { x } from 'y'` does.
        check(node.source)
      },
      ExportAllDeclaration(node) {
        check(node.source)
      },
    }
  },
}

export default noNextImage
