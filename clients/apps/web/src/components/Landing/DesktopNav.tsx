'use client'

import { AuthModal } from '@/components/Auth/AuthModal'
import GetStartedButton from '@/components/Auth/GetStartedButton'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { useModal } from '@/components/Modal/useModal'
import { usePostHog } from '@/hooks/posthog'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { Button, Grid, GridItem, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { NavLink } from './NavLink'
import { NavMenu, NavMenuLink, navMenus } from './desktopNavigation'

export const LandingPageDesktopNavigation = () => {
  const posthog = usePostHog()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const pathname = usePathname()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
    showModal()
  }

  const openMenu = navMenus.find((menu) => menu.id === openMenuId)
  const closeMenu = () => setOpenMenuId(null)

  return (
    <Box
      as="nav"
      display={{ base: 'none', md: 'flex' }}
      position="relative"
      width="100%"
      flexDirection="column"
      alignItems="center"
      paddingVertical="xl"
      backgroundColor="background-primary"
      onMouseLeave={closeMenu}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeMenu()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          closeMenu()
        }
      }}
    >
      <Box
        position="relative"
        width="100%"
        paddingHorizontal="3xl"
        alignItems="center"
        justifyContent="between"
      >
        <Box alignItems="center" columnGap="4xl">
          <Link href="/">
            <PolarLogotype logoVariant="logotype" size={100} />
          </Link>
          <Box as="ul" alignItems="center" columnGap="xl">
            {navMenus.map((menu) => (
              <Box as="li" key={menu.id}>
                <NavMenuTrigger
                  menu={menu}
                  isOpen={openMenuId === menu.id}
                  onOpen={() => setOpenMenuId(menu.id)}
                  pathname={pathname}
                />
              </Box>
            ))}
            <Box as="li" onMouseEnter={closeMenu}>
              <NavLink href="/#pricing">Pricing</NavLink>
            </Box>
            <Box as="li" onMouseEnter={closeMenu}>
              <NavLink href="/blog">Blog</NavLink>
            </Box>
            <Box as="li" onMouseEnter={closeMenu}>
              <NavLink href="/company">Company</NavLink>
            </Box>
          </Box>
        </Box>

        <Box alignItems="center" columnGap="l">
          <Button
            onClick={onLoginClick}
            variant="ghost"
            className="rounded-full"
          >
            Sign in
          </Button>
          <GetStartedButton size="default" />
        </Box>
      </Box>

      {openMenu && <NavMenuPanel menu={openMenu} onNavigate={closeMenu} />}

      <Modal
        title="Sign in"
        isShown={isModalShown}
        hide={hideModal}
        modalContent={<AuthModal />}
        className="lg:w-full lg:max-w-[480px]"
      />
    </Box>
  )
}

const NavMenuTrigger = ({
  menu,
  isOpen,
  onOpen,
  pathname,
}: {
  menu: NavMenu
  isOpen: boolean
  onOpen: () => void
  pathname: string
}) => {
  return (
    <Box aria-expanded={isOpen} onMouseEnter={onOpen} onFocus={onOpen}>
      <Text
        variant="heading-xxs"
        color={menu.isActive?.(pathname) ? 'default' : 'muted'}
      >
        {menu.title}
      </Text>
    </Box>
  )
}

const NavMenuPanel = ({
  menu,
  onNavigate,
}: {
  menu: NavMenu
  onNavigate: () => void
}) => (
  <Box
    position="absolute"
    top="100%"
    left={0}
    right={0}
    flexDirection="column"
    alignItems="center"
    backgroundColor="background-primary"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    paddingTop="2xl"
    paddingBottom="3xl"
  >
    <motion.div
      style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <Grid
        width="100%"
        paddingHorizontal="3xl"
        templateColumns="repeat(4, 1fr)"
        gap="4xl"
      >
        <GridItem colSpan={2} flexDirection="column" rowGap="xl">
          <Text color="muted">{menu.featured.title}</Text>
          <Box flexDirection="column" alignItems="start" rowGap="l">
            {menu.featured.items.map((item) => (
              <PanelLink
                key={item.href + item.label}
                item={item}
                onNavigate={onNavigate}
                featured
              />
            ))}
          </Box>
        </GridItem>
        {menu.sections.map((section) => (
          <GridItem key={section.title} flexDirection="column" rowGap="xl">
            <Text color="muted">{section.title}</Text>
            <Box as="ul" flexDirection="column" alignItems="start" rowGap="m">
              {section.items.map((item) => (
                <Box as="li" key={item.href + item.label}>
                  <PanelLink item={item} onNavigate={onNavigate} />
                </Box>
              ))}
            </Box>
          </GridItem>
        ))}
      </Grid>
    </motion.div>
  </Box>
)

const PanelLink = ({
  item,
  onNavigate,
  featured,
}: {
  item: NavMenuLink
  onNavigate: () => void
  featured?: boolean
}) => (
  <Link href={item.href} target={item.target} onClick={onNavigate}>
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      columnGap="s"
      color={{ base: 'text-primary', hover: 'text-secondary' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <Text
        as="span"
        variant={featured ? 'heading-m' : 'title'}
        color="inherit"
      >
        {item.label}
      </Text>
      {featured && item.target === '_blank' && (
        <ArrowOutwardOutlined fontSize="large" />
      )}
    </Box>
  </Link>
)
