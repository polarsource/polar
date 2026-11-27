import { expect, test } from 'vitest'
import { redact } from '../src/redact'

test.each([
  ['a UUID', 'order 2f1c0e3a-8f7a-4bd1-9c2e-1a2b3c4d5e6f', 'order <redacted>'],
  [
    'a JWT',
    'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl',
    'token <redacted>',
  ],
  ['a bearer header', 'sent Bearer abc.def', 'sent <redacted>'],
  ['a Polar token', 'with polar_oat_abc123', 'with <redacted>'],
  ['a Stripe key', 'using sk_live_abc', 'using <redacted>'],
  ['an AWS key', 'key AKIAABCDEFGHIJKLMNOP here', 'key <redacted> here'],
  [
    'a URL',
    'see https://api.polar.sh/v1/orders/?x=1 now',
    'see <redacted> now',
  ],
  ['a file path', 'in /Users/jane/app/config.ts', 'in <redacted>'],
  ['an email', 'for jane@example.com', 'for <redacted>'],
  ['an IP address', 'from 203.0.113.42', 'from <redacted>'],
  [
    'a long token',
    'hash 4c12c56eb4452fe6ff96fc1f1c5d6865863b2ccdb79a71f33b82b4f48e85d957',
    'hash <redacted>',
  ],
  [
    'a card number',
    'card 4242 4242 4242 4242 declined',
    'card <redacted> declined',
  ],
  ['a dashed card number', 'card 4242-4242-4242-4242', 'card <redacted>'],
  ['an IBAN', 'to DE89370400440532013000 today', 'to <redacted> today'],
  [
    'a spaced IBAN',
    'to DE89 3704 0044 0532 0130 00 today',
    'to <redacted> today',
  ],
  ['a lowercase IBAN', 'to de89370400440532013000', 'to <redacted>'],
  ['a Stripe customer id', 'for cus_NffrFeUfNV2Hib', 'for <redacted>'],
  ['a Stripe subscription id', 'sub_1MowQVLkdIwHu7ixeRlqHVzs', '<redacted>'],
  ['a labelled password', 'with password: hunter2! set', 'with <redacted> set'],
  ['a labelled api key', 'api_key=abc123 works', '<redacted> works'],
  ['a labelled token', 'Token = xyz', '<redacted>'],
  [
    'a quoted password',
    `password: 'my secret phrase' failed`,
    '<redacted> failed',
  ],
  [
    'a JSON password',
    'body {"password":"hunter2"} sent',
    'body {<redacted>} sent',
  ],
])('redacts %s', (_, input, output) => {
  expect(redact(input)).toBe(output)
})

test.each([
  'Set up usage-based billing for an API product, capped at $200',
  'Find the 10 most recent orders over 1000 units in 2026',
  'Compare the pro and team plans for a customer with 15 seats',
  'Check whether the token refresh webhook fired',
  'Mark the in_progress order as re_enable and set price_monthly on prod_environment',
])('leaves an ordinary intent alone: %s', (intent) => {
  expect(redact(intent)).toBe(intent)
})
