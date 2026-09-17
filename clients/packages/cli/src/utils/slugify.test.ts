import { describe, expect, test } from 'vitest'
import { slugify } from '@/utils/slugify'

describe('slugify', () => {
  test('joins, lowercases and strips accents and symbols', () => {
    expect(slugify('Crème', 'Brûlée & Co!')).toBe('creme-brulee-co')
    expect(slugify('  Hello   World ')).toBe('hello-world')
  })
})
