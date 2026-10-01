import { describe, expect, it } from 'vitest'
import {
  AI_IMAGE_VIDEO_GENERATION_CATEGORY,
  isStrictCategory,
} from './productCategories'

describe('isStrictCategory', () => {
  it('is true when a strict category is selected', () => {
    expect(
      isStrictCategory(['Software / SaaS', AI_IMAGE_VIDEO_GENERATION_CATEGORY]),
    ).toBe(true)
  })

  it('is false for regular or missing categories', () => {
    expect(isStrictCategory(['Software / SaaS'])).toBe(false)
    expect(isStrictCategory(undefined)).toBe(false)
  })
})
