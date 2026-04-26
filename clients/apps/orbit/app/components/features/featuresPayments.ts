import type { FeatureData } from './featureData'
import { TileGrid } from '../TileGrid'
import { VennPatterns } from '../VennPatterns'
import { WaveBars } from '../WaveBars'
import { ConcentricDraw } from '../ConcentricDraw'

export const paymentsFeatures: FeatureData[] = [
  {
    slug: 'checkout',
    category: 'Payments',
    categoryNumber: '02',
    title: 'Checkout',
    docsUrl: 'https://docs.polar.sh/features/checkout/session',
    subtitle: 'Embeddable, branded checkout flows that convert.',
    description:
      'Create checkout sessions programmatically with one or more products. Embed checkout inline on your site without redirects, or use hosted checkout URLs. Supports ad-hoc pricing for dynamic scenarios.',
    details: [
      { label: 'Embedded Checkout', text: 'Inline modal without redirecting users away' },
      { label: 'Multiple Products', text: 'Bundle multiple products in a single checkout session' },
      { label: 'Ad-Hoc Pricing', text: 'Create session-specific prices without modifying catalog' },
      { label: 'React & JS SDK', text: 'Import @polar-sh/checkout for advanced integrations' },
    ],
    Graphic: TileGrid,
  },
  {
    slug: 'payment-methods',
    category: 'Payments',
    categoryNumber: '02',
    title: 'Payment Methods',
    docsUrl: 'https://docs.polar.sh/features/checkout/embed',
    subtitle: 'Cards, wallets, and 135+ currencies out of the box.',
    description:
      'Accept payments via credit and debit cards, Apple Pay, Google Pay, and more. Wallet payments are enabled automatically for embedded checkout with domain validation for production use.',
    details: [
      { label: 'Card Payments', text: 'All major credit and debit card networks supported' },
      { label: 'Apple Pay', text: 'Native wallet integration with domain validation' },
      { label: 'Google Pay', text: 'One-tap payments for Android and Chrome users' },
      { label: 'Automatic Setup', text: 'Wallet payments enabled by default on embedded checkout' },
    ],
    Graphic: VennPatterns,
  },
  {
    slug: 'multi-currency',
    category: 'Payments',
    categoryNumber: '02',
    title: 'Multi-Currency',
    docsUrl: 'https://docs.polar.sh/features/products',
    subtitle: 'Sell globally with native multi-currency support.',
    description:
      'Products support multiple payment currencies including USD, EUR, GBP, CAD, AUD, JPY, CHF, SEK, INR, and BRL. Set per-currency prices or let Polar handle conversion automatically.',
    details: [
      { label: '10+ Currencies', text: 'USD, EUR, GBP, CAD, AUD, JPY, CHF, SEK, INR, BRL' },
      { label: 'Per-Currency Pricing', text: 'Set explicit prices for each supported currency' },
      { label: 'Global Reach', text: 'Customers pay in their local currency at checkout' },
      { label: 'Unified Reporting', text: 'Revenue analytics normalized across currencies' },
    ],
    Graphic: WaveBars,
  },
  {
    slug: 'tax',
    category: 'Payments',
    categoryNumber: '02',
    title: 'Tax',
    docsUrl: 'https://docs.polar.sh/features/tax-inclusive-pricing',
    subtitle: 'Automated tax calculation with location-based compliance.',
    description:
      'Fine-grained control over tax handling with three options: location-based (automatic regional conventions), inclusive (tax included in price), or exclusive (tax added at checkout). Overridable per product.',
    details: [
      { label: 'Location-Based', text: 'Automatic regional tax conventions (US exclusive, EU inclusive)' },
      { label: 'Inclusive Mode', text: 'Displayed price includes tax, extracted at checkout' },
      { label: 'Exclusive Mode', text: 'Tax added on top of the displayed price' },
      { label: 'Per-Product Override', text: 'Set defaults at org level, override per product' },
    ],
    Graphic: ConcentricDraw,
  },
]
