import PolarLogo from './PolarLogo'
import PolarLogoIcon from './PolarLogoIcon'

/**
 * LandingNav — centered Polar logo icon with generous vertical padding.
 */
export const LandingNav = () => (
  <nav className="flex w-full px-16 py-16">
    <PolarLogo className="text-neutral-900 dark:text-white" height={40} />
  </nav>
)
