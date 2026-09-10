import { isFile } from '../ast.js'

const apiHost = /(?:^|[/.@])(?:sandbox-)?api\.polar\.sh\b/

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'API hosts live in services/api.ts so POLAR_API_URL and environment selection apply everywhere.',
    },
    messages: {
      host: 'Do not hard-code the Polar API host. Build the URL with apiUrl from services/api.ts.',
    },
  },
  create(context) {
    if (isFile(context, 'services/api.ts')) return {}
    const filename = context.filename ?? context.getFilename()
    if (filename.endsWith('.test.ts') || filename.includes('/test-utils/')) {
      return {}
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string' && apiHost.test(node.value)) {
          context.report({ node, messageId: 'host' })
        }
      },
      TemplateElement(node) {
        if (apiHost.test(node.value.cooked ?? node.value.raw)) {
          context.report({ node, messageId: 'host' })
        }
      },
    }
  },
}
