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
