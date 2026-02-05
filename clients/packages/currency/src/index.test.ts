import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE, formatCurrency } from './index'

const mockIntlNumberFormat = (locale: Intl.LocalesArgument) => {
  const originalNumberFormat = Intl.NumberFormat

  const MockNumberFormat = vi.fn(function (
    this: any,
    _?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions,
  ) {
    return new originalNumberFormat(locale, options)
  }) as unknown as typeof Intl.NumberFormat

  vi.stubGlobal('Intl', {
    ...Intl,
    NumberFormat: MockNumberFormat,
  })

  return () => {
    vi.unstubAllGlobals()
  }
}

describe('formatCurrency', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Compact mode', () => {
    it('should format with small currency symbol', () => {
      expect(formatCurrency('compact')(12345, 'usd')).toEqual('$123.45')
    })
    it('should hide decimals if not necessary', () => {
      expect(formatCurrency('compact')(12300, 'usd')).toEqual('$123')
    })
    it('should be ambiguous on non-US dollar currencies in USA', () => {
      expect(formatCurrency('compact')(12300, 'cad')).toEqual('$123')
    })
    it.skipIf(DEFAULT_LOCALE !== undefined)(
      'should be ambiguous on non-US dollar currencies in FR',
      () => {
        mockIntlNumberFormat('fr-FR')
        expect(formatCurrency('compact')(12300, 'cad')).toEqual('123 $')
      },
    )
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('compact')(12300, 'jpy')).toEqual('¥12,300')
    })
  })

  describe('Standard mode', () => {
    it('should format with currency symbol and hide unnecessary decimals', () => {
      expect(formatCurrency('standard')(12345, 'usd')).toEqual('$123.45')
      expect(formatCurrency('standard')(12300, 'usd')).toEqual('$123')
    })
    it('should be explicit on non-US dollar currencies in USA', () => {
      expect(formatCurrency('standard')(12300, 'cad')).toEqual('CA$123')
    })
    it.skipIf(DEFAULT_LOCALE !== undefined)(
      'should be explicit on non euro currencies in FR',
      () => {
        mockIntlNumberFormat('fr-FR')
        expect(formatCurrency('standard')(12300, 'usd')).toEqual('123 $US')
      },
    )
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('standard')(12300, 'jpy')).toEqual('¥12,300')
    })
    it('should disambiguate currency symbols unlike compact mode', () => {
      // Both modes show $ for USD (ambiguous in en-US locale)
      expect(formatCurrency('compact')(12345, 'usd')).toEqual('$123.45')
      expect(formatCurrency('standard')(12345, 'usd')).toEqual('$123.45')

      // But standard mode disambiguates CAD as CA$ while compact shows just $
      expect(formatCurrency('compact')(12345, 'cad')).toEqual('$123.45') // Ambiguous
      expect(formatCurrency('standard')(12345, 'cad')).toEqual('CA$123.45') // Disambiguated
    })
  })

  describe('Accounting mode', () => {
    it('should format with unambiguous currency symbol in USA', () => {
      expect(formatCurrency('accounting')(12345, 'usd')).toEqual('$123.45')
      expect(formatCurrency('accounting')(12345, 'cad')).toEqual('CA$123.45')
    })
    it.skipIf(DEFAULT_LOCALE !== undefined)(
      'should format with unambiguous currency symbol in FR',
      () => {
        mockIntlNumberFormat('fr-FR')
        expect(formatCurrency('accounting')(12345, 'usd')).toEqual('123,45 $US')
        expect(formatCurrency('accounting')(12345, 'cad')).toEqual('123,45 $CA')
      },
    )
    it('should always show decimals', () => {
      expect(formatCurrency('accounting')(12300, 'usd')).toEqual('$123.00')
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('accounting')(12300, 'jpy')).toEqual('¥12,300')
    })
  })

  describe('Statistics mode', () => {
    it('should format with small currency symbol, maximum 1 digit', () => {
      expect(formatCurrency('statistics')(12345, 'usd')).toEqual('$123.5')
    })

    it('should compact big figures with multipliers, maximum 1 digit', () => {
      expect(formatCurrency('statistics')(4200000, 'usd')).toEqual('$42K')
      expect(formatCurrency('statistics')(4212010, 'usd')).toEqual('$42.1K')
      expect(formatCurrency('statistics')(4210000010, 'usd')).toEqual('$42.1M')
    })

    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('statistics')(12300, 'jpy')).toEqual('¥12.3K')
    })
  })

  describe('Subcent mode', () => {
    it('should handle small amounts', () => {
      expect(formatCurrency('subcent')(1, 'usd')).toEqual('$0.01')
      expect(formatCurrency('subcent')(0.00000001, 'usd')).toEqual(
        '$0.0000000001',
      )
      expect(formatCurrency('subcent')(0.0000000101, 'usd')).toEqual(
        '$0.000000000101',
      )
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('subcent')(0.00000001, 'jpy')).toEqual(
        '¥0.00000001',
      )
    })
  })
})
