// Source of truth: server/polar/organization/schemas.py (SLUG_MAX_LENGTH).
export const ORGANIZATION_SLUG_MAX_LENGTH = 64

// Source of truth: server/polar/config.py, keep in sync.
// Backend validates regardless, but this is to give the user immediate feedback in the onboarding
// since org creation (and validation) is in the last step.
const BLOCKED_WORDS = [
  'porn',
  'porno',
  'pornography',
  'sex',
  'sexual',
  'sexy',
  'nsfw',
  'xxx',
  'hentai',
  'erotic',
  'erotica',
  'fetish',
  'nude',
  'nudes',
  'nudity',
  'onlyfans',
  'camgirl',
  'escort',
]

const BLOCKED_PATTERN = new RegExp(`\\b(${BLOCKED_WORDS.join('|')})\\b`, 'i')

export function containsBlockedWord(value: string): boolean {
  return BLOCKED_PATTERN.test(value)
}

// Source of truth: the "Product Words" sheet maintained by the compliance team.
const FLAGGED_PRODUCT_PHRASES: Record<string, string> = {
  'human services':
    'consulting, consultation, coaching, mentorship, 1-on-1, 1:1, done-for-you, custom, freelance, call, book a session',
  'sponsorships and donations':
    'sponsorship, sponsor, donate, donation, tip jar, support my work, buy me a coffee, crowdfunding, fundraiser, patron, contribution',
  advertising:
    'advertising, ad placement, sponsored post, sponsored listing, featured listing, promoted listing, banner ads, paid promotion, ad space',
  'lead generation and outreach':
    'lead generation, leads, prospecting, cold email, cold outreach, bulk email, mass DM, SMS campaign, contact lists, appointment setting, email scraping',
  'marketplaces and resale':
    'marketplace, vendor, seller commission, revenue share, reseller, third-party sellers, creator marketplace, storefront builder, sell on our platform',
  'adult content':
    'NSFW, erotic, sexting, adult companion, AI girlfriend, AI boyfriend, OnlyFans, explicit content, nudify, undress AI',
  gambling:
    'casino, betting, sportsbook, lottery, raffle, loot box, mystery box, slots, poker, wager, gambling',
  'financial trading and investment advice':
    'trading bot, forex, crypto signals, stock picks, investment advice, portfolio signals, trading signals, wealth management, NFT, token sale',
  'cheating and circumvention tools':
    'aimbot, wallhack, game cheats, exam answers, bypass, unlock premium, paywall bypass, account cracking, captcha bypass, anti-detect',
  'personal data lookups':
    'people search, background check, phone lookup, email lookup, reverse lookup, leaked data, data broker, personal information database',
  'intellectual property infringement':
    'cracked software, license keys resale, pirated, copyright removal, watermark removal, YouTube downloader, Instagram downloader, content ripper',
  'government services':
    'visa filing, immigration filing, government forms, tax filing service, passport application, government fee, official filing',
  'job boards':
    'job posting, job listing, post a job, recruitment marketplace, candidate database, resume database, hiring board, job advertisement',
  'medical advice':
    'medical consultation, diagnosis, treatment plan, prescription, symptom checker, health advice, medical advice',
  weapons:
    'firearms, guns, ammunition, gun parts, weapon training, firearm simulator, ballistics',
  'IPTV and telecom services':
    'IPTV, M3U playlist, streaming channels, eSIM, SIM activation, VoIP minutes, phone number rental',
  'physical goods':
    'shipping, delivery, merchandise, physical product, print on demand, dropshipping, inventory, fulfillment',
  'technical support services':
    'remote repair, PC repair, tech support session, troubleshooting service, device repair, remote assistance',
}

const FLAGGED_PRODUCT_PATTERNS = Object.entries(FLAGGED_PRODUCT_PHRASES).map(
  ([category, phrases]) =>
    [
      category,
      new RegExp(`\\b(${phrases.split(', ').join('|')})s?\\b`, 'i'),
    ] as const,
)

export interface FlaggedProductPhrase {
  category: string
  phrase: string
}

export function findFlaggedProductPhrase(
  name: string,
): FlaggedProductPhrase | null {
  for (const [category, pattern] of FLAGGED_PRODUCT_PATTERNS) {
    const match = pattern.exec(name)
    if (match) return { category, phrase: match[0] }
  }
  return null
}
