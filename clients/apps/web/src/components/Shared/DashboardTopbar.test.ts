import { path } from './DashboardTopbar'

test('DashboardTopbar.path', () => {
  expect(path('/issues/[organization]/[repo]', 'org')).toBe('/issues/org')
  expect(path('/issues/[organization]', 'org', 'repo')).toBe('/issues/org/repo')

  expect(path('/dependencies/[organization]/[repo]', 'org')).toBe(
    '/dependencies/org',
  )
  expect(path('/dependencies/[organization]', 'org', 'repo')).toBe(
    '/dependencies/org/repo',
  )

  expect(path('/finance/[organization]', 'org')).toBe('/finance/org')

  expect(path('/finance/[organization]', 'org', 'repo')).toBe(
    '/issues/org/repo',
  )
})
