import { describe, expect, it } from 'vitest'
import { assessmentFacts } from './assessmentFacts'
import { assessmentPreviewRow } from './previewFixture'
import { reviewStatus } from './reviewStatus'

describe('assessmentPreviewRow', () => {
  it('matches the current assessment drawer fixture', () => {
    const facts = assessmentFacts(assessmentPreviewRow)

    expect(facts.email).toBe('smard@nvidia.com')
    expect(facts.customerTaxId).toBe('911144442')
    expect(facts.productName).toBe('Pepy Pro')
    expect(facts.price).toBe('$90.00')
    expect(facts.interval).toBe('Every year')
    expect(facts.renewal).toBe('Jan 17, 2027')
    expect(facts.status).toBe('Active')
    expect(facts.automaticTax).toBe('Disabled')
    expect(assessmentPreviewRow.tax_behavior).toBe('inclusive')
    expect(assessmentPreviewRow.customer_country).toBeNull()
    expect(assessmentPreviewRow.reason_code).toBe('customer_missing_country')
    expect(reviewStatus(assessmentPreviewRow)).toEqual({
      label: 'Ready to switch',
    })
  })
})
