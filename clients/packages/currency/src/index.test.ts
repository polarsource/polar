import { describe, expect, it } from 'vitest'
import { formatCurrency } from './index'

describe('formatCurrency', () => {
  describe('Presenting mode', () => {
    it('should format with small currency symbol', () => {
      expect(formatCurrency('presenting')(12345, 'usd')).toEqual('$123.45')
    })
    it('should hide decimals if not necessary', () => {
      expect(formatCurrency('presenting')(12300, 'usd')).toEqual('$123')
    })
    it('should be ambiguous on non-US dollar currencies', () => {
      expect(formatCurrency('presenting')(12300, 'cad')).toEqual('$123')
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('presenting')(12300, 'jpy')).toEqual('¥12,300')
    })
  })

  describe('Accounting mode', () => {
    it('should format with currency code', () => {
      expect(formatCurrency('accounting')(12345, 'usd')).toEqual(
        'USD\u00A0123.45',
      )
    })
    it('should always show decimals', () => {
      expect(formatCurrency('accounting')(12300, 'usd')).toEqual(
        'USD\u00A0123.00',
      )
    })
    it('should handle non-decimal currencies', () => {
      expect(formatCurrency('accounting')(12300, 'jpy')).toEqual(
        'JPY\u00A012,300',
      )
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
