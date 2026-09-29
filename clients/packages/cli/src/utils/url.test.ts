import { describe, expect, test } from 'vitest'
import { redactUrl } from '@/utils/url'

describe('redactUrl', () => {
  test.each([
    ['http://localhost:3000/webhooks', 'http://localhost:3000/webhooks'],
    [
      'http://user:s3cret@localhost:3000/webhooks',
      'http://***@localhost:3000/webhooks',
    ],
    ['https://t0ken@my-app.dev/webhooks', 'https://***@my-app.dev/webhooks'],
    [
      'http://localhost:3000/webhooks?token=t0ken&source=polar',
      'http://localhost:3000/webhooks?token=***&source=***',
    ],
    ['http://localhost:3000/webhooks#s3cret', 'http://localhost:3000/webhooks'],
  ])('shows %s as %s', (input, expected) => {
    expect(redactUrl(input)).toBe(expected)
  })
})
