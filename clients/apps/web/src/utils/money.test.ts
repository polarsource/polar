import { getCentsInDollarString } from '.'

test('getCentsInDollarString', () => {
  expect(getCentsInDollarString(12300)).toBe('123')
  expect(getCentsInDollarString(12300, true)).toBe('123.00')
  expect(getCentsInDollarString(12300, true, true)).toBe('123.00')
  expect(getCentsInDollarString(123456700, false, true)).toBe('1,234,567')
  expect(getCentsInDollarString(123456700, true, true)).toBe('1,234,567.00')
})
