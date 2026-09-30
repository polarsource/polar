import { twMerge } from 'tailwind-merge'
import { LOGO_ICON_VIEWBOX, LOGO_MARK_PATH } from './paths'

const LogoIcon = ({
  className,
  size = 29,
}: {
  className?: string
  size?: number
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox={LOGO_ICON_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={twMerge(className ? className : '')}
    >
      <path d={LOGO_MARK_PATH} fill="currentColor" />
    </svg>
  )
}

export default LogoIcon
