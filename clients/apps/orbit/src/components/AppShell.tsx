import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@polar-sh/ui/components/ui/sidebar'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { DocsSidebar } from './Sidebar'

// Uses the shadcn Sidebar primitives (the same ones the Polar dashboard uses):
// SidebarProvider sets up the sidebar context + the recessed page surface, the
// inset Sidebar floats in the gutter, and SidebarInset renders the main content
// as a rounded, shadowed card. On mobile the sidebar is an off-canvas sheet
// opened from the header trigger.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <DocsSidebar />
      {/* min-w-0 lets the inset shrink below its content's intrinsic width so
          wide children (code blocks, tables) scroll instead of overflowing the
          viewport. On md+ the card is fixed to the viewport and scrolls itself. */}
      <SidebarInset className="border-polar-700 min-w-0 border md:h-[calc(100svh-1rem)] md:overflow-y-auto">
        <Box
          as="header"
          display={{ base: 'flex', md: 'none' }}
          position="sticky"
          top={0}
          zIndex={20}
          alignItems="center"
          columnGap="s"
          paddingHorizontal="l"
          paddingVertical="s"
          backgroundColor="background-secondary"
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <SidebarTrigger />
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Text variant="default" color="default">
              Orbit
            </Text>
          </Link>
        </Box>

        <Box
          flexDirection="column"
          width="100%"
          minWidth={0}
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
