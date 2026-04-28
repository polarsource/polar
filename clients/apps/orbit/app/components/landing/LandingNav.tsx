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
  <nav className="sticky top-0 z-50 flex flex-col items-center gap-8 bg-white py-12 dark:bg-black">
    <div className="flex w-full max-w-[1760px] flex-row items-center gap-8">
      <Link href="/" className="mr-auto">
        <PolarLogo className="text-neutral-900 dark:text-white" height={36} />
      </Link>

      <FeaturesDropdown />
      <NavLink href="/company">Company</NavLink>
      <NavLink href="/docs">Docs</NavLink>
      <Button href="#">Get Started</Button>
    </div>
  </nav>
)
