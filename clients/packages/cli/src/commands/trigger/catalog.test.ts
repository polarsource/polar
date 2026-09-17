import { expect, test } from 'vitest'
import { formatCatalog } from '@/commands/trigger/catalog'
import { stripAnsi } from '@/utils/test-utils/cli'

test('groups events by resource with aligned descriptions', () => {
  const output = stripAnsi(
    formatCatalog([
      { type: 'checkout.created', description: 'A checkout was created.' },
      { type: 'checkout.expired', description: 'A checkout expired.' },
      { type: 'order.paid', description: 'An order was paid.' },
    ]),
  )

  expect(output).toContain('  checkout\n')
  expect(output).toContain('    checkout.created  A checkout was created.')
  expect(output).toContain('    checkout.expired  A checkout expired.')
  expect(output).toContain('\n\n  order\n')
  expect(output).toContain('    order.paid        An order was paid.')
  expect(output).toContain('polar trigger <event>')
})
