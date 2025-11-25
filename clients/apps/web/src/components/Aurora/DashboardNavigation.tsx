import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'

const navigationItems = (organization: schemas['Organization']) => [
  {
    label: 'Home',
    href: `/dashboard/${organization.slug}`,
    isActive: (path: string) => path === `/dashboard/${organization.slug}`,
  },
  {
    label: 'Catalogue',
    href: `/dashboard/${organization.slug}/catalogue`,
  },
  {
    label: 'Sales',
    href: `/dashboard/${organization.slug}/sales`,
  },
  {
    label: 'Analytics',
    href: `/dashboard/${organization.slug}/analytics`,
  },
]

const NavigationItem = ({
  label,
  href,
  isActive,
}: {
  label: string
  href: string
  isActive?: (path: string) => boolean
}) => {
  const pathname = usePathname()
  const active = isActive ? isActive(pathname) : pathname.includes(href)

  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link
      href={href}
      className={twMerge(
        'relative flex flex-1 flex-row items-center justify-center overflow-hidden px-16 py-8',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      prefetch
    >
      <motion.div
        className="bg-polar-950 dark:bg-polar-50 absolute inset-0 h-full"
        variants={{
          hover: { y: 'calc(100% - 2px)' },
          active: { y: '0%' },
          initial: { y: '100%' },
        }}
        initial="initial"
        animate={active ? 'active' : isHovered ? 'hover' : 'initial'}
        exit="initial"
        transition={{ duration: 0.2, ease: [0.87, 0, 0.13, 1] }}
      />
      <span
        className={twMerge(
          'relative z-10 text-lg',
          active
            ? 'text-polar-50 dark:text-polar-950 font-medium'
            : 'text-polar-950 dark:text-polar-50',
        )}
      >
        {label}
      </span>
    </Link>
  )
}

export const DashboardNavigation = () => {
  const { organization } = useContext(OrganizationContext)

  return (
    <nav className="dark:border-polar-800 dark:divide-polar-800 grid grid-cols-6 divide-x divide-gray-200 border-b border-gray-200">
      <div className="flex flex-row items-center justify-center px-16 py-8">
        <PolarLogotype size={64} />
      </div>
      {navigationItems(organization).map((item) => (
        <NavigationItem key={item.href} {...item} />
      ))}
      <button
        className="flex flex-col items-center justify-center gap-y-2 px-16 py-8"
        aria-label="Open menu"
        type="button"
      >
        <span className="bg-polar-950 dark:bg-polar-50 block h-0.5 w-16 transition-all" />
        <span className="bg-polar-950 dark:bg-polar-50 block h-0.5 w-16 transition-all" />
      </button>
    </nav>
  )
}
