import { twMerge } from 'tailwind-merge'
import { LOGO_MARK_PATH, LOGO_TYPE_VIEWBOX, LOGO_WORDMARK_PATH } from './paths'

const LogoType = ({
  className,
  width,
  height,
}: {
  className?: string
  width?: number
  height?: number
}) => {
  return (
    <svg
      viewBox={LOGO_TYPE_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={twMerge(className ? className : '')}
      width={width}
      height={height}
    >
      <path d={LOGO_WORDMARK_PATH} fill="currentColor" />
      <path d={LOGO_MARK_PATH} fill="currentColor" />
    </svg>
  )
}

export default LogoType
