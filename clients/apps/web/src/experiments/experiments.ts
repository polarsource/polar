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
  checkout_terms: {
    description:
      'Move terms and conditions text from inside payment element to below the form',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
  checkout_business_checkbox: {
    description:
      'Redesign business checkbox: subtle styling below billing address with grouped billing details box',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
} as const
