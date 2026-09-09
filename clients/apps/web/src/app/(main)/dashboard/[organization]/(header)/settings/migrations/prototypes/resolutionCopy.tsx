import { PrototypeVariant, ResolutionDomain } from './model'

export function domainNavLabel(
  domain: ResolutionDomain,
  presentation: PrototypeVariant,
): string {
  if (presentation === 'assisted') {
    if (domain === 'product') {
      return 'Product mapping'
    }
    if (domain === 'country') {
      return 'Billing country'
    }
    return 'Customer identity'
  }
  if (domain === 'product') {
    return 'Product'
  }
  if (domain === 'country') {
    return 'Country'
  }
  return 'Identity'
}

export function domainRiskLine(domain: ResolutionDomain): string {
  if (domain === 'product') {
    return 'Pro catalog collision may duplicate benefits.'
  }
  if (domain === 'country') {
    return 'Missing country blocks tax on renewal.'
  }
  return 'Email / Stripe id mismatch risks a bad merge.'
}

export function domainAttentionLabel(domain: ResolutionDomain): string {
  if (domain === 'product') {
    return 'Map product'
  }
  if (domain === 'country') {
    return 'Set country'
  }
  return 'Reconcile customer'
}

export function domainCopy(
  domain: ResolutionDomain,
  presentation: PrototypeVariant,
  index: number,
): { eyebrow: string; headline: string; context: string } {
  const guidedNumber = `Decision ${index}`
  if (domain === 'product') {
    if (presentation === 'guided') {
      return {
        eyebrow: guidedNumber,
        headline: 'Map Stripe Pro or keep it separate',
        context:
          'Compare Stripe Pro to the Polar Pro already in your catalog, then choose how colliding subscriptions should land.',
      }
    }
    if (presentation === 'assisted') {
      return {
        eyebrow: 'Polar proposal',
        headline: 'Approve product mapping for Stripe Pro',
        context:
          'Polar proposes mapping Stripe Pro onto your existing Polar Pro so benefits stay unified. You can still create a separate product or leave affected subscriptions on Stripe.',
      }
    }
    if (presentation === 'tower') {
      return {
        eyebrow: 'Product',
        headline: 'Pro catalog collision',
        context: 'Map, split, or leave on Stripe.',
      }
    }
    return {
      eyebrow: 'Product',
      headline: 'Existing Polar product',
      context: 'Confirm mapping for Stripe Pro ($19/month).',
    }
  }

  if (domain === 'country') {
    if (presentation === 'guided') {
      return {
        eyebrow: guidedNumber,
        headline: 'Confirm a billing country',
        context:
          'Uma NoCountry has no billing country today. Card-issuer evidence weakly suggests United Kingdom; tax on the next renewal depends on your choice.',
      }
    }
    if (presentation === 'assisted') {
      return {
        eyebrow: 'Polar proposal',
        headline: 'Approve United Kingdom for tax',
        context:
          'Polar proposes confirming United Kingdom from weak card-issuer evidence so VAT can be calculated. You can choose Germany instead, or leave this subscription on Stripe.',
      }
    }
    if (presentation === 'tower') {
      return {
        eyebrow: 'Country',
        headline: 'Missing billing country',
        context: 'Confirm UK, pick Germany, or leave on Stripe.',
      }
    }
    return {
      eyebrow: 'Tax',
      headline: 'Customer missing country',
      context: 'Suggested: United Kingdom (issuer evidence).',
    }
  }

  if (presentation === 'guided') {
    return {
      eyebrow: guidedNumber,
      headline: 'Reconcile the customer identity',
      context:
        'A Polar customer already uses this email with a different Stripe id. Linking merges history; creating a duplicate or leaving on Stripe avoids an unintended merge.',
    }
  }
  if (presentation === 'assisted') {
    return {
      eyebrow: 'Polar proposal',
      headline: 'Approve linking the shared email',
      context:
        'Polar proposes linking the Stripe customer onto the existing Polar customer for this email. Creating a separate customer or leaving the conflict on Stripe keeps them disconnected.',
    }
  }
  if (presentation === 'tower') {
    return {
      eyebrow: 'Identity',
      headline: 'Email / Stripe id conflict',
      context: 'Link, duplicate, or leave on Stripe.',
    }
  }
  return {
    eyebrow: 'Identity',
    headline: 'Customer Stripe id conflict',
    context: 'Same email, different Stripe customer id.',
  }
}
