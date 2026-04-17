import PolarLogoIcon from './PolarLogoIcon'

/**
 * LandingNav — centered Polar logo icon with generous vertical padding.
 */
export const LandingNav = () => (
  <nav className="flex w-full items-center justify-center border-b border-neutral-800 px-12 py-12">
    <PolarLogoIcon className="text-white" size={60} />
  </nav>
)
