const subjectOf = (filename) => {
  const match = /\/src\/(.+?)(?:\/index)?\.test\.ts$/.exec(filename)
  return match?.[1]
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A test file sits next to the module it covers and is named after it.',
    },
    messages: {
      subject:
        'This test does not import "@/{{subject}}". Name test files after the module they cover and keep them next to it.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()
    const subject = subjectOf(filename)
    if (!subject) return {}
    let found = false
    return {
      ImportDeclaration(node) {
        if (node.source.value === `@/${subject}`) found = true
      },
      'Program:exit'(node) {
        if (!found) {
          context.report({ node, messageId: 'subject', data: { subject } })
        }
      },
    }
  },
}
