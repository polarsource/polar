/**
 * LandingNav — minimal top nav. Logo left, sparse links right.
 */
export const LandingNav = () => (
  <nav className="flex w-full items-center justify-between border-b border-neutral-800 px-12 py-5">
    <div className="text-base font-medium uppercase text-white">
      Polar
    </div>
    <div className="flex items-center gap-8 text-base text-neutral-500">
      <a href="#product" className="transition hover:text-white">Product</a>
      <a href="#architecture" className="transition hover:text-white">Architecture</a>
      <a href="#pricing" className="transition hover:text-white">Pricing</a>
      <a href="#docs" className="transition hover:text-white">Docs</a>
      <a
        href="#get-started"
        className="border border-neutral-700 px-4 py-1.5 text-white transition hover:border-white"
      >
        Get Started
      </a>
    </div>
  </nav>
);
