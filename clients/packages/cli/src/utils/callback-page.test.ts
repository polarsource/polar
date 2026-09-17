import { describe, expect, test } from 'vitest'
import { callbackPage } from '@/utils/callback-page'

describe('callbackPage', () => {
  test.each([
    ['success', 'You are signed in', 'close this tab'],
    ['denied', 'Sign-in canceled', '<code>polar auth login</code>'],
    ['invalid', 'Something went wrong', 'invalid or has expired'],
  ] as const)('renders the %s page', (outcome, title, hint) => {
    const html = callbackPage(outcome)
    expect(html).toContain(`<h1>${title}</h1>`)
    expect(html).toContain(hint)
  })
})
