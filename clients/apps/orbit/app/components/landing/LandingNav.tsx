import Link from 'next/link'
import PolarLogo from './PolarLogo'
import { Button } from './Button'
import { FeaturesDropdown } from './FeaturesDropdown'

const NavLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => (
  <Link
    href={href}
    className="text-xl font-medium text-black transition hover:text-neutral-900 dark:text-white dark:hover:text-white"
  >
    {children}
  </Link>
)

export const LandingNav = () => (
  <nav className="relative z-50 flex w-full items-center gap-10 py-16">
    <Link href="/" className="mr-auto">
      <PolarLogo className="text-neutral-900 dark:text-white" height={36} />
    </Link>

    <FeaturesDropdown />
    <NavLink href="/company">Company</NavLink>
    <NavLink href="/docs">Docs</NavLink>
    <Button href="#">Get Started</Button>
  </nav>
)
