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
  'placeholder-experiment': {
    description: 'Placeholder description',
    variants: ['control', 'treatment'] as const,
    defaultVariant: 'control',
  },
} as const
