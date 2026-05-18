import { Box } from '@polar-sh/orbit/Box'
import { SearchProvider } from './SearchContext'
import { ShellContent } from './ShellContent'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box
      as="main"
      display="flex"
      flexDirection="row"
      minHeight="100vh"
      width="100%"
    >
      <Sidebar />
      <Box
        display="flex"
        flexDirection="column"
        flex={1}
        minWidth={0}
        maxWidth="1280px"
        marginHorizontal="auto"
      >
        <SearchProvider>
          <TopBar />
          <ShellContent>{children}</ShellContent>
        </SearchProvider>
      </Box>
    </Box>
  )
}
