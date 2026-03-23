import { Text } from '@polar-sh/orbit'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@polar-sh/ui/components/ui/sidebar'
import type { ReactNode } from 'react'
import { OrbitNav } from './OrbitNav'

export default function OrbitLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <OrbitNav />
      <SidebarInset className="dark:bg-polar-950 overflow-y-auto bg-white">
        {/* Mobile header — hidden on md+ where the sidebar is always visible */}
        <header className="dark:border-polar-800 dark:bg-polar-900 sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:hidden">
          <SidebarTrigger />
          <Text as="span">Orbit</Text>
        </header>
        <div className="mx-auto w-full max-w-3xl px-8 py-16 md:px-12">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
