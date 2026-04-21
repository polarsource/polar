/**
 * RetroCursor — pixelated retro hand cursor SVG, used as a large
 * hover decoration on the CTA button.
 */
export const RetroCursor = ({ className }: { className?: string }) => (
  <svg
    width="180"
    height="201"
    viewBox="0 0 180 201"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M0 110L20 90L50 120L60 10H70H90L80 50H100L120 70H140L150 80H160L180 100V150L160 170H170L140 200H70L40 170V150L0 110Z" fill="url(#retro-grad)" />
    <path d="M80 0H60V10H80V0Z" fill="currentColor" />
    <path d="M60 10H50V120H60V10Z" fill="currentColor" />
    <path d="M90 10H80V100H90V10Z" fill="currentColor" />
    <path d="M110 50H90V60H110V50Z" fill="currentColor" />
    <path d="M120 60H110V100H120V60Z" fill="currentColor" />
    <path d="M140 60H120V70H140V60Z" fill="currentColor" />
    <path d="M160 70H140V80H160V70Z" fill="currentColor" />
    <path d="M150 80H140V110H150V80Z" fill="currentColor" />
    <path d="M170 80H160V90H170V80Z" fill="currentColor" />
    <path d="M180 90H170V160H180V90Z" fill="currentColor" />
    <path d="M40 100H30V110H40V100Z" fill="currentColor" />
    <path d="M30 90H0V100H30V90Z" fill="currentColor" />
    <path d="M10 100H0V120H10V100Z" fill="currentColor" />
    <path d="M20 120H10V130H20V120Z" fill="currentColor" />
    <path d="M30 130H20V140H30V130Z" fill="currentColor" />
    <path d="M39.9991 140H30V160H39.9991V140Z" fill="currentColor" />
    <path d="M49.9999 160H40V180H49.9999V160Z" fill="currentColor" />
    <path d="M150 190.04H60V200.04H150V190.04Z" fill="currentColor" />
    <path d="M170 160H160V180H170V160Z" fill="currentColor" />
    <path d="M50 110H40V120H50V110Z" fill="currentColor" />
    <path d="M60 180H50V190H60V180Z" fill="currentColor" />
    <path d="M160 180H150V190H160V180Z" fill="currentColor" />
    <defs>
      <linearGradient id="retro-grad" x1="70" y1="190" x2="110" y2="130" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E2E2E2" />
        <stop offset="1" stopColor="white" />
      </linearGradient>
    </defs>
  </svg>
)
