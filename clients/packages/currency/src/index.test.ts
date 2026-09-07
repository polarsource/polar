import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  getLocaleDecimalSeparator,
  parseMoneyValue,
} from './index'

describe('formatCurrency', () => {
  describe('Compact mode', () => {
    it('should format with small currency symbol', () => {
      expect(formatCurrency('compact', 'en-US')(12345, 'usd')).toEqual(
        '$123.45',
      )
    })
    it('should hide decimals if not necessary', () => {
      expect(formatCurrency('compact', 'en-US')(12300, 'usd')).toEqual('$123')
    })
    it('should be ambiguous on non-US dollar currencies in USA', () => {
      expect(formatCurrency('compact', 'en-US')(12300, 'cad')).toEqual('$123')
    })
    it('should be ambiguous on non-US dollar currencies in FR', () => {
      expect(formatCurrency('compact', 'fr-FR')(12300, 'cad')).toEqual('123 $')
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('compact', 'en-US')(12300, 'jpy')).toEqual(
        '¥12,300',
      )
    })
  })

  describe('Standard mode', () => {
    it('should format with currency symbol and hide unnecessary decimals', () => {
      expect(formatCurrency('standard', 'en-US')(12345, 'usd')).toEqual(
        '$123.45',
      )
      expect(formatCurrency('standard', 'en-US')(12300, 'usd')).toEqual('$123')
    })
    it('should be explicit on non-US dollar currencies in USA', () => {
      expect(formatCurrency('standard', 'en-US')(12300, 'cad')).toEqual(
        'CA$123',
      )
    })
    it('should be explicit on non euro currencies in FR', () => {
      expect(formatCurrency('standard', 'fr-FR')(12300, 'usd')).toEqual(
        '123 $US',
      )
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('standard', 'en-US')(12300, 'jpy')).toEqual(
        '¥12,300',
      )
    })
    it('should disambiguate currency symbols unlike compact mode', () => {
      // Both modes show $ for USD (ambiguous in en-US locale)
      expect(formatCurrency('compact', 'en-US')(12345, 'usd')).toEqual(
        '$123.45',
      )
      expect(formatCurrency('standard', 'en-US')(12345, 'usd')).toEqual(
        '$123.45',
      )

      // But standard mode disambiguates CAD as CA$ while compact shows just $
      expect(formatCurrency('compact', 'en-US')(12345, 'cad')).toEqual(
        '$123.45',
      ) // Ambiguous
      expect(formatCurrency('standard', 'en-US')(12345, 'cad')).toEqual(
        'CA$123.45',
      ) // Disambiguated
    })
  })

  describe('Accounting mode', () => {
    it('should format with unambiguous currency symbol in USA', () => {
      expect(formatCurrency('accounting', 'en-US')(12345, 'usd')).toEqual(
        '$123.45',
      )
      expect(formatCurrency('accounting', 'en-US')(12345, 'cad')).toEqual(
        'CA$123.45',
      )
    })
    it('should format with unambiguous currency symbol in FR', () => {
      expect(formatCurrency('accounting', 'fr-FR')(12345, 'usd')).toEqual(
        '123,45 $US',
      )
      expect(formatCurrency('accounting', 'fr-FR')(12345, 'cad')).toEqual(
        '123,45 $CA',
      )
    })
    it('should always show decimals', () => {
      expect(formatCurrency('accounting', 'en-US')(12300, 'usd')).toEqual(
        '$123.00',
      )
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('accounting', 'en-US')(12300, 'jpy')).toEqual(
        '¥12,300',
      )
    })
  })

  describe('Statistics mode', () => {
    // Statistics mode are an opinionated balance between accurracy and readability.
    // The main goal is to always land between 4-7 characters (excluding currency symbol) (including separators) (including the K/M/B/T multipliers)
    // while keeping the number as accurate as possible.
    // This means there are certain thresholds where the formatting / rounding / significant digits change to keep the output concise and accurate.
    //
    // I have strong feelings about this, haha, so before making any changes here, please chat with me — @pieterbeulque
    it('should format small numbers with small currency symbol, either 0 or 2 digits', () => {
      expect(formatCurrency('statistics', 'en-US')(1, 'usd')).toEqual('$0.01')
      expect(formatCurrency('statistics', 'en-US')(12, 'usd')).toEqual('$0.12')
      expect(formatCurrency('statistics', 'en-US')(123, 'usd')).toEqual('$1.23')
      expect(formatCurrency('statistics', 'en-US')(1200, 'usd')).toEqual('$12')
      expect(formatCurrency('statistics', 'en-US')(1230, 'usd')).toEqual(
        '$12.30',
      )
      expect(formatCurrency('statistics', 'en-US')(1234, 'usd')).toEqual(
        '$12.34',
      )
      expect(formatCurrency('statistics', 'en-US')(12345, 'usd')).toEqual(
        '$123.45',
      )
    })

    it('should format thousands without multipliers, either 0 or 2 digits', () => {
      expect(formatCurrency('statistics', 'en-US')(123400, 'usd')).toEqual(
        '$1,234',
      )
      expect(formatCurrency('statistics', 'en-US')(123456, 'usd')).toEqual(
        '$1,234.56',
      )
    })

    // tens & hundreds of thousands are an exception case.
    // For example, $12.34K <> $12,345 or $123.45K <> $123,456 but loses a significant digit, so we show in full, no decimals
    it('should format tens of thousands without multipliers, no digits', () => {
      expect(formatCurrency('statistics', 'en-US')(1234500, 'usd')).toEqual(
        '$12,345',
      )
      expect(formatCurrency('statistics', 'en-US')(1234567, 'usd')).toEqual(
        '$12,345',
      )
    })

    it('should format hundreds of thousands without multipliers, no digits', () => {
      expect(formatCurrency('statistics', 'en-US')(12345678, 'usd')).toEqual(
        '$123,456',
      )
    })

    it('should compact big figures with multipliers, maximum 5 significant digits, maximum 3 decimal digits', () => {
      expect(formatCurrency('statistics', 'en-US')(123456700, 'usd')).toEqual(
        '$1.235M',
      )
      expect(formatCurrency('statistics', 'en-US')(1234567800, 'usd')).toEqual(
        '$12.346M',
      )
      expect(formatCurrency('statistics', 'en-US')(12345678900, 'usd')).toEqual(
        '$123.46M',
      )
    })

    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('statistics', 'en-US')(123456700, 'jpy')).toEqual(
        '¥123.46M',
      )
    })

    it('should apply the same thresholds to negative values', () => {
      expect(formatCurrency('statistics', 'en-US')(-12345, 'usd')).toEqual(
        '-$123.45',
      )
      expect(formatCurrency('statistics', 'en-US')(-1234500, 'usd')).toEqual(
        '-$12,345',
      )
      expect(formatCurrency('statistics', 'en-US')(-12345678, 'usd')).toEqual(
        '-$123,456',
      )
      expect(formatCurrency('statistics', 'en-US')(-123456700, 'usd')).toEqual(
        '-$1.235M',
      )
      expect(
        formatCurrency('statistics', 'en-US')(-12345678900, 'usd'),
      ).toEqual('-$123.46M')
    })
  })

  describe('Subcent mode', () => {
    it('should handle small amounts', () => {
      expect(formatCurrency('subcent', 'en-US')(1, 'usd')).toEqual('$0.01')
      expect(formatCurrency('subcent', 'en-US')(0.0001, 'usd')).toEqual(
        '$0.000001',
      )
      expect(formatCurrency('subcent', 'en-US')(0.0101, 'usd')).toEqual(
        '$0.000101',
      )
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('subcent', 'en-US')(0.000001, 'jpy')).toEqual(
        '¥0.000001',
      )
    })
  })
})

describe('getLocaleDecimalSeparator', () => {
  it.each([
    ['en', '.'],
    ['en-US', '.'],
    ['ja', '.'],
    ['ko', '.'],
    ['de', ','],
    ['de-DE', ','],
    ['fr', ','],
    ['fr-FR', ','],
    ['es', ','],
    ['it', ','],
    ['nl', ','],
    ['pt', ','],
    ['pt-PT', ','],
    ['sv', ','],
    ['tr', ','],
    ['pl', ','],
    ['hu', ','],
  ] as const)('returns the decimal separator for %s', (locale, expected) => {
    expect(getLocaleDecimalSeparator(locale)).toBe(expected)
  })
})

describe('parseMoneyValue', () => {
  describe('period-decimal locales (en) — comma is a thousands separator', () => {
    it.each([
      ['5', '5'],
      ['5.5', '5.5'],
      ['5.55', '5.55'],
      ['5000', '5000'],
      ['5,000', '5000'],
      ['1,234', '1234'],
      ['12,345', '12345'],
      ['1,000,000', '1000000'],
      ['1,000,000,000', '1000000000'],
      ['5,000.99', '5000.99'],
      ['1,000.50', '1000.50'],
      ['12,345.67', '12345.67'],
      ['1,234,567.89', '1234567.89'],
      ['0.25', '0.25'],
      ['0.99', '0.99'],
    ] as const)(
      'parses %p -> %p (no thousands collapse)',
      (input, expected) => {
        expect(parseMoneyValue(input, '.')).toBe(expected)
      },
    )

    it('strips a trailing comma as a thousands separator (not a decimal)', () => {
      expect(parseMoneyValue('5,', '.')).toBe('5')
    })

    it('treats a mid-string comma as thousands while typing groups', () => {
      expect(parseMoneyValue('5,0', '.')).toBe('50')
      expect(parseMoneyValue('5,00', '.')).toBe('500')
      expect(parseMoneyValue('5,000', '.')).toBe('5000')
    })

    it('keeps a trailing period so the user can type decimals', () => {
      expect(parseMoneyValue('5.', '.')).toBe('5.')
      expect(parseMoneyValue('12.', '.')).toBe('12.')
    })

    it('rounds the fractional part to 2 digits', () => {
      expect(parseMoneyValue('5.555', '.')).toBe('5.55')
      expect(parseMoneyValue('5.999', '.')).toBe('5.99')
      expect(parseMoneyValue('1,234.567', '.')).toBe('1234.56')
    })

    it('does not reinsert a leading zero when the integer part is empty', () => {
      expect(parseMoneyValue('.5', '.')).toBe('.5')
      expect(parseMoneyValue('.55', '.')).toBe('.55')
    })

    it('strips everything except digits, commas and periods', () => {
      expect(parseMoneyValue('$5,000.99', '.')).toBe('5000.99')
      expect(parseMoneyValue('abc 1,234.56 xyz', '.')).toBe('1234.56')
      expect(parseMoneyValue('5 000,99', '.')).toBe('500099')
    })

    it('returns an empty string for empty / non-numeric input', () => {
      expect(parseMoneyValue('', '.')).toBe('')
      expect(parseMoneyValue('abc', '.')).toBe('')
    })
  })

  describe('comma-decimal locales (de) — comma is the decimal separator', () => {
    it.each([
      ['12,5', '12.5'],
      ['12,50', '12.50'],
      ['12,500', '12.50'],
      ['1,99', '1.99'],
      ['1.234,56', '1234.56'],
      ['12.345,67', '12345.67'],
      ['1.234.567,89', '1234567.89'],
    ] as const)('parses %p -> %p (European convention)', (input, expected) => {
      expect(parseMoneyValue(input, ',')).toBe(expected)
    })

    it('keeps a trailing comma so the user can type decimals', () => {
      expect(parseMoneyValue('12,', ',')).toBe('12.')
    })

    it('treats a pasted period (no comma) as the decimal of an edited value', () => {
      // The component displays committed values with a period (toFixed), so
      // editing "12.50" must round-trip, and a European paste of "1.234"
      // (thousands-only) is a known pre-existing edge, not a regression.
      expect(parseMoneyValue('12.50', ',')).toBe('12.50')
      expect(parseMoneyValue('12.5', ',')).toBe('12.5')
    })

    it('rounds the fractional part to 2 digits', () => {
      expect(parseMoneyValue('12,555', ',')).toBe('12.55')
      expect(parseMoneyValue('1.234,999', ',')).toBe('1234.99')
    })

    it('returns an empty string for empty / non-numeric input', () => {
      expect(parseMoneyValue('', ',')).toBe('')
      expect(parseMoneyValue('abc', ',')).toBe('')
    })
  })
})
