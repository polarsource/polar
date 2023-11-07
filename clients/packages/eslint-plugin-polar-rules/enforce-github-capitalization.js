'use strict'

module.exports = {
  create(context) {
    return {
      JSXText(node) {
        const text = node.value
        const match = text.match(/github(?!\.com)/i)
        if (match) {
          if (match[0] !== 'GitHub') {
            context.report({
              node,
              message: `GitHub brand should be capitalized as "GitHub", not ${match[0]}`,
            })
          }
        }
      },
    };
  },
}
