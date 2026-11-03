const REDACTIONS: ReadonlyArray<RegExp> = [
  // hi haters
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\bBearer\s+\S+/gi,
  /\b(?:polar_|sk_|pk_|rk_|whsec_|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|glpat-|xox[baprs]-|AIza|ya29\.)[A-Za-z0-9_.-]+/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi,
  /(?:\/Users|\/home|\/root|\/tmp|\/var|\/private|[A-Za-z]:\\Users)(?:[\\/]\S*|\b)/g,
  /\S+@\S+\.\S+/g,
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
  /\b[A-Za-z0-9_-]{32,}\b/g,
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi,
  /\b[A-Z]{2}\d{2}(?: [A-Z0-9]{4}){2,7}(?: [A-Z0-9]{1,4})?\b/g,
  /\b(?:\d[ -]?){12,18}\d\b/g,
  /\b(?:cus|sub|pi|ch|in|prod|price|acct|pm|cs|re|txn|evt)_(?=[A-Za-z0-9]*[A-Z0-9])[A-Za-z0-9]{8,}\b/g,
  /["']?\b(?:password|passwd|pwd|secret|token|api[_-]?key)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi,
  // bye haters
]

export const redact = (text: string) =>
  REDACTIONS.reduce(
    (result, pattern) => result.replace(pattern, '<redacted>'),
    text,
  )
