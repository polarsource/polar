import { parseGitHubIssueLink } from '.'

describe('parseGitHubIssueLink', () => {
  it.each([
    'https://github.com/polarsource/open-testing/issues/1',
    'https://GITHUB.com/polarsource/open-testing/issues/1',
    'https://github.com/polarsource/open-testing/issues/1#issue-1700071352',
    'https://github.com/polarsource/open-testing/issues/1#issuecomment-1538213428',
    'polarsource/open-testing#1',
  ])('should parse %s', (url) => {
    expect(parseGitHubIssueLink(url)).toEqual({
      raw: url,
      owner: 'polarsource',
      repo: 'open-testing',
      number: 1,
    })
  })

  it.each([
    'foobar',
    'https://gitlab.com/polarsource/open-testing/issues/1',
    'polarsource/open-testing',
  ])('should not parse %s', (url) => {
    expect(parseGitHubIssueLink(url)).toBeUndefined()
  })
})
