'use client'

import { Box } from '@polar-sh/orbit/Box'
import { schemas } from '@polar-sh/client'
import { SearchProvider } from './SearchContext'
import { ShellContent } from './ShellContent'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

type AppShellProps = {
  type: 'organization' | 'account'
  organization?: schemas['Organization']
  organizations: schemas['Organization'][]
  children: React.ReactNode
}

export const AppShell = ({
  type,
  organization,
  organizations,
  children,
}: AppShellProps) => (
  <Box
    as="main"
    display="flex"
    flexDirection="row"
    minHeight="100vh"
    width="100%"
  >
    <Sidebar type={type} organization={organization} />
    <Box display="flex" flexDirection="column" flex={1} minWidth={0}>
      <SearchProvider>
        <TopBar
          type={type}
          organization={organization}
          organizations={organizations}
        />
        <ShellContent>{children}</ShellContent>
      </SearchProvider>
    </Box>
  </Box>
)
