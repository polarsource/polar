import { schemas } from '@polar-sh/client'
import { filterDiscountUpdatePayload, isDiscountFixedType, isDiscountPercentageType } from './discount'

describe('discount utilities', () => {
  describe('isDiscountFixedType', () => {
    it('should return true for fixed discount type', () => {
      expect(isDiscountFixedType({ type: 'fixed' })).toBe(true)
    })

    it('should return false for percentage discount type', () => {
      expect(isDiscountFixedType({ type: 'percentage' })).toBe(false)
    })
  })

  describe('isDiscountPercentageType', () => {
    it('should return true for percentage discount type', () => {
      expect(isDiscountPercentageType({ type: 'percentage' })).toBe(true)
    })

    it('should return false for fixed discount type', () => {
      expect(isDiscountPercentageType({ type: 'fixed' })).toBe(false)
    })
  })

  describe('filterDiscountUpdatePayload', () => {
    it('should exclude currency and amount for percentage discounts', () => {
      const percentageUpdate: schemas['DiscountUpdate'] = {
        type: 'percentage',
        name: 'Test Discount',
        basis_points: 1000,
        currency: 'usd', // This should be filtered out
        amount: 100, // This should be filtered out
        code: 'TEST'
      }

      const result = filterDiscountUpdatePayload(percentageUpdate)

      expect(result).toEqual({
        type: 'percentage',
        name: 'Test Discount',
        basis_points: 1000,
        code: 'TEST'
      })
      expect(result).not.toHaveProperty('currency')
      expect(result).not.toHaveProperty('amount')
    })

    it('should exclude basis_points for fixed discounts', () => {
      const fixedUpdate: schemas['DiscountUpdate'] = {
        type: 'fixed',
        name: 'Test Discount',
        amount: 100,
        currency: 'usd',
        basis_points: 1000, // This should be filtered out
        code: 'TEST'
      }

      const result = filterDiscountUpdatePayload(fixedUpdate)

      expect(result).toEqual({
        type: 'fixed',
        name: 'Test Discount',
        amount: 100,
        currency: 'usd',
        code: 'TEST'
      })
      expect(result).not.toHaveProperty('basis_points')
    })

    it('should return unchanged payload when no type is provided', () => {
      const update: schemas['DiscountUpdate'] = {
        name: 'Test Discount',
        amount: 100,
        currency: 'usd',
        basis_points: 1000,
        code: 'TEST'
      }

      const result = filterDiscountUpdatePayload(update)

      expect(result).toEqual(update)
    })

    it('should handle partial updates correctly', () => {
      const percentageUpdate: schemas['DiscountUpdate'] = {
        type: 'percentage',
        name: 'Updated Name'
      }

      const result = filterDiscountUpdatePayload(percentageUpdate)

      expect(result).toEqual({
        type: 'percentage',
        name: 'Updated Name'
      })
    })
  })
})