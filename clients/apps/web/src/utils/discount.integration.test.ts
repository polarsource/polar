import { schemas } from '@polar-sh/client'
import { filterDiscountUpdatePayload } from './discount'

describe('discount update integration test', () => {
  it('should properly filter percentage discount update payload in real-world scenario', () => {
    // Simulate a percentage discount from the API response
    const percentageDiscount: schemas['Discount'] = {
      id: 'test-id',
      type: 'percentage',
      name: 'Black Friday Sale',
      code: 'BLACKFRIDAY',
      basis_points: 2500, // 25%
      // Note: percentage discounts don't have currency or amount in their type definition
      organization_id: 'org-id',
      products: [],
      duration: 'once',
      redemptions_count: 0,
      created_at: '2023-01-01T00:00:00Z',
      modified_at: '2023-01-01T00:00:00Z'
    } as schemas['Discount']

    // Simulate form data that might include currency (from form initialization with all fields)
    const formUpdate: schemas['DiscountUpdate'] = {
      name: 'Updated Black Friday Sale',
      code: 'BLACKFRIDAY2024',
      type: 'percentage',
      basis_points: 3000, // 30%
      currency: 'usd', // This should be filtered out
      amount: 100 // This should be filtered out
    }

    // Apply the filtering logic as it would be in UpdateDiscountModalContent
    const filteredUpdate = filterDiscountUpdatePayload(formUpdate)

    // Verify currency and amount are excluded
    expect(filteredUpdate).toEqual({
      name: 'Updated Black Friday Sale',
      code: 'BLACKFRIDAY2024',
      type: 'percentage',
      basis_points: 3000
    })
    
    expect(filteredUpdate).not.toHaveProperty('currency')
    expect(filteredUpdate).not.toHaveProperty('amount')
  })

  it('should preserve currency and amount for fixed discount updates', () => {
    // Simulate a fixed discount from the API response
    const fixedDiscount: schemas['Discount'] = {
      id: 'test-id',
      type: 'fixed',
      name: 'Holiday Discount',
      code: 'HOLIDAY10',
      amount: 1000, // $10.00
      currency: 'usd',
      organization_id: 'org-id',
      products: [],
      duration: 'once',
      redemptions_count: 0,
      created_at: '2023-01-01T00:00:00Z',
      modified_at: '2023-01-01T00:00:00Z'
    } as schemas['Discount']

    // Simulate form data that might include basis_points (from form initialization)
    const formUpdate: schemas['DiscountUpdate'] = {
      name: 'Updated Holiday Discount',
      code: 'HOLIDAY15',
      type: 'fixed',
      amount: 1500, // $15.00
      currency: 'usd',
      basis_points: 1000 // This should be filtered out
    }

    // Apply the filtering logic
    const filteredUpdate = filterDiscountUpdatePayload(formUpdate)

    // Verify basis_points is excluded but currency and amount are preserved
    expect(filteredUpdate).toEqual({
      name: 'Updated Holiday Discount',
      code: 'HOLIDAY15',
      type: 'fixed',
      amount: 1500,
      currency: 'usd'
    })
    
    expect(filteredUpdate).not.toHaveProperty('basis_points')
    expect(filteredUpdate).toHaveProperty('currency', 'usd')
    expect(filteredUpdate).toHaveProperty('amount', 1500)
  })

  it('should handle scenario where type comes from existing discount object', () => {
    // This simulates the actual scenario in UpdateDiscountModalContent where
    // the type is set from the existing discount
    const existingDiscount = { type: 'percentage' }
    
    const formUpdate: schemas['DiscountUpdate'] = {
      name: 'Updated Name',
      currency: 'usd' // Should be filtered out
    }

    // Add the type as done in the component
    const updateWithType = { ...formUpdate, type: existingDiscount.type as schemas['DiscountType'] }
    
    const filteredUpdate = filterDiscountUpdatePayload(updateWithType)

    expect(filteredUpdate).toEqual({
      name: 'Updated Name',
      type: 'percentage'
    })
    expect(filteredUpdate).not.toHaveProperty('currency')
  })
})