import type { ComponentType } from 'react'
import { billingFeatures } from './featuresBilling'
import { paymentsFeatures } from './featuresPayments'
import { platformFeatures } from './featuresPlatform'
import { infrastructureFeatures } from './featuresInfrastructure'

export interface FeatureDetail {
  label: string
  text: string
}

export interface FeatureData {
  slug: string
  category: string
  categoryNumber: string
  title: string
  subtitle: string
  description: string
  details: FeatureDetail[]
  docsUrl: string
  Graphic: ComponentType
}

export const FEATURES: FeatureData[] = [
  ...billingFeatures,
  ...paymentsFeatures,
  ...platformFeatures,
  ...infrastructureFeatures,
]

const featureMap = new Map(FEATURES.map((f) => [f.slug, f]))

export function getFeature(slug: string): FeatureData | undefined {
  return featureMap.get(slug)
}

export function getAllSlugs(): string[] {
  return FEATURES.map((f) => f.slug)
}
