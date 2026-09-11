import { describe, expect, test } from 'vitest'
import { callbackPage } from '@/utils/callback-page'
import { loginCommand, type PolarEnvironment } from '@/schemas/Auth'

const environments: readonly PolarEnvironment[] = ['sandbox', 'production']

describe('callbackPage', () => {
  test.each([
    ['success', 'You are signed in'],
    ['denied', 'Sign-in canceled'],
    ['invalid', 'Something went wrong'],
  ] as const)(
    'renders the %s page with its title for every environment',
    (outcome, title) => {
      for (const environment of environments) {
        expect(callbackPage(outcome, environment)).toContain(
          `<h1>${title}</h1>`,
        )
      }
    },
  )

  test('the success page suggests no login command', () => {
    for (const environment of environments) {
      expect(callbackPage('success', environment)).not.toContain(
        'polar auth login',
      )
    }
  })

  test.each(['denied', 'invalid'] as const)(
    'the %s page suggests the environment-aware login command',
    (outcome) => {
      for (const environment of environments) {
        expect(callbackPage(outcome, environment)).toContain(
          `<code>${loginCommand(environment)}</code>`,
        )
      }
    },
  )

  test('the production error pages never suggest the sandbox or bare login command', () => {
    for (const outcome of ['denied', 'invalid'] as const) {
      const html = callbackPage(outcome, 'production')
      expect(html).not.toContain('<code>polar auth login</code>')
      expect(html).not.toContain('<code>polar auth login --sandbox</code>')
    }
  })
})
