/**
 * All active experiments
 *
 * To add a new experiment:
 * 1. Create a new experiment in PostHog
 * 2. Add it here with variants and default
 * 3. Use useExperiment() or <Experiment> in your components
 *
 * Below is an example of a experiment definition:
 * test_experiment: {
 *   description: 'Brief description of what the experiment does',
 *   variants: ['control', 'treatment'] as const,
 *   defaultVariant: 'control',
 * }
 */
export const experiments = {} as const
