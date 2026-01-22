/**
 * All active experiments
 *
 * To add a new experiment:
 * 1. Create a new experiment in PostHog
 * 2. Add it here with variants and default
 * 3. Use useExperiment() or <Experiment> in your components
 *
* IMPORTANT: Event ordering for PostHog funnels
* ---------------------------------------------
* PostHog funnels require events to fire in the correct order.
* For checkout experiments, the sequence must be:
*   1. $feature_flag_called (exposure) - fires when useExperiment() is called
*   2. checkout:open - fires in useEffect AFTER experiment hooks
*   3. checkout:complete - fires server-side on successful payment
*
* The checkout:open call was moved to a client-side useEffect (in Checkout.tsx)
* specifically to ensure it fires AFTER the exposure event. If moved back to
* server-side (page.tsx), it will fire before JS hydrates and break the funnel.
*
* See: PR #9071 (introduced server-side tracking)
*      PR #9116 (fixed distinct_id mismatch)
*      PR #XXXX (fixed event ordering)
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
