'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@polar-sh/ui/components/ui/sidebar'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navSections } from '@/lib/registry'

function Wordmark() {
  return (
    <Link href="/" style={{ textDecoration: 'none' }}>
      <Box alignItems="center" columnGap="s">
        <Box
          alignItems="center"
          justifyContent="center"
          width={28}
          height={28}
          borderRadius="m"
          backgroundColor="background-inverse"
        >
          <Text variant="label" color="inverse">
            O
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text variant="default" color="default">
            Orbit
          </Text>
          <Text variant="caption" color="default">
            Polar Design System
          </Text>
        </Box>
      </Box>
    </Link>
  )
}

export function DocsSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader>
        <Box paddingHorizontal="s" paddingVertical="xs">
          <Wordmark />
        </Box>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent! data-[active=true]:text-sidebar-accent-foreground! dark:data-[active=true]:bg-sidebar-accent!"
                  >
                    <Link href={item.href}>{item.title}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
