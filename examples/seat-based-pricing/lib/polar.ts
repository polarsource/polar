import { Polar } from '@polar-sh/sdk'

// Initialize Polar client with access token from environment
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || '',
})

// Helper to get organization ID from environment
export const getOrganizationId = (): string => {
  const orgId = process.env.POLAR_ORGANIZATION_ID
  if (!orgId) {
    throw new Error('POLAR_ORGANIZATION_ID is not set in environment variables')
  }
  return orgId
}

// Helper to get base URL
export const getBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}
