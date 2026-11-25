import { useAuth } from '@/hooks/auth'
import { renderWithProviders } from '@/test-utils/render'
import type { schemas } from '@polar-sh/client'
import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { UserContextProvider } from './auth'

it('updates organizations when the server refreshes the signed-in user', () => {
  const user = {
    id: 'user',
    organizations: [],
  } as unknown as schemas['UserRead']
  const organization = {
    name: 'New organization',
  } as schemas['OrganizationWithRole']
  function OrganizationList() {
    const { userOrganizations } = useAuth()
    return <div>{userOrganizations.map((org) => org.name).join(', ')}</div>
  }

  const { rerender } = renderWithProviders(
    <UserContextProvider user={user}>
      <OrganizationList />
    </UserContextProvider>,
  )
  expect(screen.queryByText(organization.name)).toBeNull()
  rerender(
    <UserContextProvider user={{ ...user, organizations: [organization] }}>
      <OrganizationList />
    </UserContextProvider>,
  )
  expect(screen.getByText(organization.name)).toBeInTheDocument()
})
