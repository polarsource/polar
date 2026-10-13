import { expect, test } from 'vitest'
import { hasEnv, upsertEnv } from '@/utils/env-file'

test('creates the variable in an empty file', () => {
  expect(upsertEnv('', 'POLAR_ACCESS_TOKEN', 'polar_oat_1')).toEqual({
    content: 'POLAR_ACCESS_TOKEN=polar_oat_1\n',
    replaced: false,
  })
})

test('appends the variable on a new line', () => {
  expect(upsertEnv('A=1', 'POLAR_ACCESS_TOKEN', 'polar_oat_1')).toEqual({
    content: 'A=1\nPOLAR_ACCESS_TOKEN=polar_oat_1\n',
    replaced: false,
  })
})

test.each([
  'POLAR_ACCESS_TOKEN=old',
  'export POLAR_ACCESS_TOKEN=old',
  '  POLAR_ACCESS_TOKEN = "old"',
])('replaces an existing assignment: %s', (existing) => {
  expect(
    upsertEnv(`A=1\n${existing}\nB=2\n`, 'POLAR_ACCESS_TOKEN', 'polar_oat_1'),
  ).toEqual({
    content: 'A=1\nPOLAR_ACCESS_TOKEN=polar_oat_1\nB=2\n',
    replaced: true,
  })
})

test('removes later duplicates so the new value wins', () => {
  expect(
    upsertEnv(
      'POLAR_ACCESS_TOKEN=a\nB=2\nexport POLAR_ACCESS_TOKEN=b\n',
      'POLAR_ACCESS_TOKEN',
      'new',
    ),
  ).toEqual({ content: 'POLAR_ACCESS_TOKEN=new\nB=2\n', replaced: true })
})

test('leaves variables that share a prefix alone', () => {
  expect(
    upsertEnv('POLAR_ACCESS_TOKEN_OLD=x\n', 'POLAR_ACCESS_TOKEN', 'new'),
  ).toEqual({
    content: 'POLAR_ACCESS_TOKEN_OLD=x\nPOLAR_ACCESS_TOKEN=new\n',
    replaced: false,
  })
})

test('finds an existing assignment', () => {
  expect(
    hasEnv('A=1\nexport POLAR_ENVIRONMENT=sandbox\n', 'POLAR_ENVIRONMENT'),
  ).toBe(true)
  expect(hasEnv('POLAR_ENVIRONMENT_X=1\n', 'POLAR_ENVIRONMENT')).toBe(false)
})
