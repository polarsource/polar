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
  checkout_merchant_avatar_experiment: {
    description:
      'Replace the merchant avatar with the merchant name in the checkout product info',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
} as const
