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
    it('should format with small currency symbol, maximum 1 digit', () => {
      expect(formatCurrency('statistics', 'en-US')(12345, 'usd')).toEqual(
        '$123.5',
      )
    })

    it('should compact big figures with multipliers, maximum 1 digit', () => {
      expect(formatCurrency('statistics', 'en-US')(4200000, 'usd')).toEqual(
        '$42K',
      )
      expect(formatCurrency('statistics', 'en-US')(4212010, 'usd')).toEqual(
        '$42.1K',
      )
      expect(formatCurrency('statistics', 'en-US')(4210000010, 'usd')).toEqual(
        '$42.1M',
      )
    })

    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('statistics', 'en-US')(12300, 'jpy')).toEqual(
        '¥12.3K',
      )
    })
  })

  describe('Subcent mode', () => {
    it('should handle small amounts', () => {
      expect(formatCurrency('subcent', 'en-US')(1, 'usd')).toEqual('$0.01')
      expect(formatCurrency('subcent', 'en-US')(0.00000001, 'usd')).toEqual(
        '$0.0000000001',
      )
      expect(formatCurrency('subcent', 'en-US')(0.0000000101, 'usd')).toEqual(
        '$0.000000000101',
      )
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('subcent', 'en-US')(0.00000001, 'jpy')).toEqual(
        '¥0.00000001',
      )
    })
  })
})
