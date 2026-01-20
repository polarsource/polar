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
  checkout_form_first: {
    description: 'Flip checkout layout - form on left, product on right',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
  checkout_button_subscribe: {
    description: 'Button copy: Subscribe vs Subscribe now',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
  checkout_button_pay: {
    description: 'Button copy: Pay vs Pay now',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
} as const
