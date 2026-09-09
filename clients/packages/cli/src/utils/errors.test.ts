import { describe, expect, test } from 'vitest'
import { ListenError } from '@/commands/listen'
import { UpdateError } from '@/commands/update'
import { describeError } from '@/utils/errors'
import { AuthError } from '@/schemas/Auth'
import { GitHubReleaseError } from '@/services/github-releases'

const releasesHint =
  'Releases are published at https://github.com/polarsource/polar/releases'

describe('describeError', () => {
  test('uses the message of plain errors', () => {
    expect(describeError(new Error('boom'))).toEqual({ title: 'boom' })
  })

  test('falls back to a generic title for non-error values', () => {
    expect(describeError('boom')).toEqual({
      title: 'An unexpected error occurred',
    })
    expect(describeError(null)).toEqual({
      title: 'An unexpected error occurred',
    })
    expect(describeError({ _tag: 'Other' })).toEqual({
      title: 'An unexpected error occurred',
    })
  })

  test('describes auth errors without a hint', () => {
    expect(describeError(new AuthError({ message: 'Not logged in' }))).toEqual({
      title: 'Not logged in',
    })
  })

  test.each([
    [403, 'You do not have access to this organization.'],
    [404, 'The organization could not be found.'],
    [503, 'The Polar API may be having issues, try again shortly.'],
  ])('hints listen errors with status %d', (code, hint) => {
    expect(
      describeError(new ListenError({ message: 'Listen failed', code })),
    ).toEqual({ title: 'Listen failed', hint })
  })

  test('omits the hint for other listen status codes', () => {
    expect(
      describeError(new ListenError({ message: 'Listen failed', code: 400 })),
    ).toEqual({ title: 'Listen failed' })
  })

  test('points update errors at the releases page', () => {
    expect(describeError(new UpdateError({ message: 'No asset' }))).toEqual({
      title: 'No asset',
      hint: releasesHint,
    })
  })

  test('prefixes GitHub release errors', () => {
    expect(
      describeError(new GitHubReleaseError({ message: 'rate limited' })),
    ).toEqual({
      title: 'Could not check for updates: rate limited',
      hint: releasesHint,
    })
  })
})
