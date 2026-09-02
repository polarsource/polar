/**
 * All active experiments
 *
 * To add a new experiment:
 * 1. Create a new experiment in PostHog
 * 2. Add it here with variants and default
 * 3. Use useExperiment() or <Experiment> in your components
 *
 */
export const experiments = {
  test_experiment: {
    description: 'Test experiment',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
  onboarding_flow_v1: {
    description: 'Test onboarding flow variations',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
  checkout_trial_due_today: {
    description:
      'Show an emphasized "Due today $0" total on trial checkouts, with the recurring price de-emphasized',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
  checkout_cta_primary_color: {
    description:
      'Alternative primary color for the checkout CTA button instead of the default black/white',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
} as const
