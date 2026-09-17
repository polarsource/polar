export const ONBOARDING_STEPS = [
  {
    id: 'personal',
    route: '/onboarding/personal',
    title: 'Personal details',
    description: 'Tell us a bit about yourself',
  },
  {
    id: 'business',
    route: '/onboarding/business',
    title: 'Business details',
    description: 'Tell us about your organization',
  },
  {
    id: 'product',
    route: '/onboarding/product',
    title: 'Product details',
    description: 'What you are building and selling',
  },
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id']
