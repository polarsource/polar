import { describe, expect, it } from 'vitest'
import { formatCurrency } from './index'

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
