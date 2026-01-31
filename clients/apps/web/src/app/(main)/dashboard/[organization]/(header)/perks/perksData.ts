/**
 * Startup Stack - Curated deals for Spaire founders
 * Last verified: January 30, 2026
 *
 * This is a headless, local-first approach. All data lives here.
 * No third-party API calls. Claim buttons open partner application pages.
 */

// S3 bucket base URL (using non-regional endpoint to match CSP)
const S3_BASE = 'https://spaire-production-files-public.s3.amazonaws.com'

export interface Perk {
  id: string
  provider: string
  logoUrl: string
  headline: string
  description: string
  spaireAdvantage: string
  applyUrl: string
  category: 'banking' | 'cloud' | 'productivity' | 'analytics' | 'ai' | 'growth'
}

export const perksData: Perk[] = [
  {
    id: 'mercury',
    provider: 'Mercury',
    logoUrl: `${S3_BASE}/mercury-logo.svg`,
    headline: '$500 Signup Bonus',
    description:
      'Modern banking built for startups. Receive $250 for depositing $10k within 90 days, plus an additional $250 for spending $1k on the Mercury card. Unlimited free transfers, integrated treasury, and powerful financial workflows.',
    spaireAdvantage:
      'Apply through the Mercury for Startups program. Spaire merchants can connect their Mercury account for instant RTP payouts directly to their operating account.',
    applyUrl: 'https://mercury.com/partner/startups',
    category: 'banking',
  },
  {
    id: 'aws',
    provider: 'AWS Activate',
    logoUrl: `${S3_BASE}/amazon_web_services_logo.jpeg`,
    headline: '$5,000 in Credits',
    description:
      'Access the full AWS cloud infrastructure with up to $5,000 in credits valid for 2 years. Build on 200+ services including compute, storage, databases, machine learning, and serverless architecture.',
    spaireAdvantage:
      'Apply through the AWS Activate Portfolio program. Early-stage startups with less than $10M in funding qualify. Credits apply to most AWS services including EC2, S3, and Lambda.',
    applyUrl: 'https://aws.amazon.com/activate/',
    category: 'cloud',
  },
  {
    id: 'notion',
    provider: 'Notion',
    logoUrl: `${S3_BASE}/notionhq_logo.jpeg`,
    headline: '6 Months Free',
    description:
      'The connected workspace for modern teams. Get 6 months of the Plus plan free, including unlimited AI, advanced permissions, and 30-day page history. Consolidate docs, wikis, and project management in one tool.',
    spaireAdvantage:
      'Apply through Notion for Startups. Requires less than $10M in funding and fewer than 50 employees. Includes unlimited AI features for drafting, editing, and summarizing content.',
    applyUrl: 'https://www.notion.so/startups',
    category: 'productivity',
  },
  {
    id: 'stripe-atlas',
    provider: 'Stripe Atlas',
    logoUrl: `${S3_BASE}/stripe_logo.jpeg`,
    headline: '20% Off Incorporation',
    description:
      'Form your Delaware C-Corp in days, not weeks. Stripe Atlas handles articles of incorporation, EIN application, registered agent, and post-incorporation compliance. The gold standard for startup formation.',
    spaireAdvantage:
      'Apply directly through Stripe Atlas. Combined with Spaire as your Merchant of Record, you get a complete financial stack from day one. Stripe Atlas founders also receive $5k in Stripe processing credits.',
    applyUrl: 'https://stripe.com/atlas',
    category: 'banking',
  },
  {
    id: 'hubspot',
    provider: 'HubSpot',
    logoUrl: `${S3_BASE}/hubspot_logo.jpeg`,
    headline: '90% Off Year 1',
    description:
      'The CRM platform that scales with you. Get 90% off HubSpot for your first year, including Marketing Hub, Sales Hub, and Service Hub. Professional-grade tools without the enterprise price tag.',
    spaireAdvantage:
      'Apply through HubSpot for Startups. Eligible startups must be seed-stage, VC-backed, and have less than $2M in funding. Discount applies to Professional and Enterprise tiers.',
    applyUrl: 'https://www.hubspot.com/startups',
    category: 'growth',
  },
  {
    id: 'posthog',
    provider: 'PostHog',
    logoUrl: `${S3_BASE}/posthog_logo.jpeg`,
    headline: '$50,000 in Credits',
    description:
      'The open-source product analytics suite. PostHog combines analytics, session recording, feature flags, A/B testing, and surveys in one platform. Self-hostable with full data control.',
    spaireAdvantage:
      'Apply through PostHog for Startups. Must be less than 2 years old with under $5M in funding. Credits cover all PostHog products including analytics, replay, and experimentation.',
    applyUrl: 'https://posthog.com/startups',
    category: 'analytics',
  },
  {
    id: 'linear',
    provider: 'Linear',
    logoUrl: `${S3_BASE}/linear.jpeg`,
    headline: '6 Months Free',
    description:
      'The issue tracker built for modern software teams. Linear offers keyboard-first design, cycles for sprint planning, and seamless GitHub integration. Fast, focused, and beautifully designed.',
    spaireAdvantage:
      'Apply through Linear for Startups. Eligible companies receive 6 months of the Standard or Plus plan. After the trial, competitive startup pricing continues.',
    applyUrl: 'https://linear.app/startups',
    category: 'productivity',
  },
  {
    id: 'intercom',
    provider: 'Intercom',
    logoUrl: `${S3_BASE}/intercom_logo.jpeg`,
    headline: '90% Off Year 1',
    description:
      'The AI-first customer service platform. Intercom combines live chat, help desk, and AI agent (Fin) to resolve customer issues instantly. Used by 25,000+ businesses worldwide.',
    spaireAdvantage:
      'Apply through the Intercom Early Stage program. Must be seed-stage with less than $1M in funding. Includes AI Fin resolutions and the full Intercom platform.',
    applyUrl: 'https://www.intercom.com/early-stage',
    category: 'growth',
  },
  {
    id: 'vercel',
    provider: 'Vercel',
    logoUrl: `${S3_BASE}/vercel_logo.jpeg`,
    headline: '$2,400 in Credits',
    description:
      'The platform for frontend developers. Receive $200/month for 12 months to deploy Next.js, React, and other frameworks. Automatic CI/CD, edge functions, and global CDN included.',
    spaireAdvantage:
      'Apply through Vercel for Startups. Credits apply to Pro plan usage including serverless functions, bandwidth, and build minutes. Perfect for scaling your frontend infrastructure.',
    applyUrl: 'https://vercel.com/startups',
    category: 'cloud',
  },
  {
    id: 'openai',
    provider: 'OpenAI',
    logoUrl: `${S3_BASE}/open+ai+-+logo.jpg`,
    headline: '$2,500 in API Credits',
    description:
      'Build with the most advanced AI models. Access GPT-4o, o1, DALL-E 3, Whisper, and embeddings. Credits apply to all API usage for prototyping and production workloads.',
    spaireAdvantage:
      'Apply through OpenAI for Startups. Must be a funded startup building AI-first products. Credits are valid for 12 months and cover all OpenAI API models.',
    applyUrl: 'https://openai.com/startups',
    category: 'ai',
  },
  {
    id: 'airtable',
    provider: 'Airtable',
    logoUrl: `${S3_BASE}/airtable-logo.jpeg`,
    headline: '$2,000 in Credits',
    description:
      'The low-code platform for building apps. Airtable combines spreadsheet flexibility with database power. Build custom workflows, CRMs, and internal tools without engineering resources.',
    spaireAdvantage:
      'Apply through Airtable for Startups. Eligible companies receive $2,000 in credits for Team or Business plans. Ideal for ops-heavy startups scaling their internal tooling.',
    applyUrl: 'https://airtable.com/startups',
    category: 'productivity',
  },
  {
    id: 'mixpanel',
    provider: 'Mixpanel',
    logoUrl: `${S3_BASE}/mixpanel_inc__logo.jpeg`,
    headline: '$50,000 in Credits',
    description:
      'Product analytics that drives growth. Mixpanel offers funnel analysis, cohort retention, and user segmentation. Understand how users engage with your product at every stage.',
    spaireAdvantage:
      'Apply through Mixpanel for Startups. Must be an early-stage company with less than $8M in funding. Credits are valid for the first year and cover Growth plan features.',
    applyUrl: 'https://mixpanel.com/startups',
    category: 'analytics',
  },
]

// Category metadata for filtering/display
export const categories = {
  banking: { label: 'Banking & Finance', order: 1 },
  cloud: { label: 'Cloud & Infrastructure', order: 2 },
  productivity: { label: 'Productivity', order: 3 },
  analytics: { label: 'Analytics', order: 4 },
  ai: { label: 'AI & ML', order: 5 },
  growth: { label: 'Growth & Marketing', order: 6 },
} as const
