import { Box } from '@polar-sh/orbit/Box'
import {
  SidebarInset,
  SidebarProvider,
} from '@polar-sh/ui/components/ui/sidebar'
import { type ReactNode } from 'react'
import { DocsSidebar } from './Sidebar'

// Uses the shadcn Sidebar primitives (the same ones the Polar dashboard uses):
// SidebarProvider sets up the sidebar context + the recessed page surface, the
// inset Sidebar floats in the gutter, and SidebarInset renders the main content
// as a rounded, shadowed card. Content is centered in a max-width column.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <DocsSidebar />
      {/* Fix the card to the viewport height and scroll its content internally
          (on md+) so the inset rounded corners always stay in view. */}
      <SidebarInset className="border-polar-700 border md:h-[calc(100svh-1rem)] md:overflow-y-auto">
        <Box
          flexDirection="column"
          width="100%"
          maxWidth={1040}
          marginHorizontal="auto"
          paddingHorizontal={{ base: 'l', md: '3xl' }}
          paddingVertical={{ base: 'xl', md: '3xl' }}
        >
          {children}
        </Box>
      </SidebarInset>
    </SidebarProvider>
  )
}
