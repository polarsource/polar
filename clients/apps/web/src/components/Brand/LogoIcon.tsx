import { twMerge } from 'tailwind-merge'

const LogoIcon = ({
  className,
  size = 29,
}: {
  className?: string
  size?: number
}) => {
  return (
    <>
      {/* Light mode logo */}
      <img
        src="/spaire-logo-light.png"
        alt="Logo"
        width={size}
        height={size}
        className={twMerge('block dark:hidden', className)}
      />

      {/* Dark mode logo */}
      <img
        src="/spaire-logo-dark.png"
        alt="Logo"
        width={size}
        height={size}
        className={twMerge('hidden dark:block', className)}
      />
    </>
  )
}

export default LogoIcon

