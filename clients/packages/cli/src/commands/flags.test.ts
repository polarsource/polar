import { expect, test } from 'vitest'
import { environmentOf } from '@/commands/flags'

test('maps the production flag to an environment', () => {
  expect(environmentOf(true)).toBe('production')
  expect(environmentOf(false)).toBe('sandbox')
})
