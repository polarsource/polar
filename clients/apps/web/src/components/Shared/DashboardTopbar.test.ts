import { path } from './DashboardTopbar'

test('DashboardTopbar.path', () => {
  expect(path('/maintainer/[organization]/issues?repo=[repo]', 'org')).toBe(
    '/maintainer/org/issues',
  )
  expect(path('/maintainer/[organization]/issues', 'org', 'repo')).toBe(
    '/maintainer/org/issues?repo=repo',
  )

  expect(path('/maintainer/[organization]/finance', 'org')).toBe(
    '/maintainer/org/finance',
  )

  expect(path('/maintainer/[organization]/finance', 'org', 'repo')).toBe(
    '/maintainer/org/issues?repo=repo',
  )
})
