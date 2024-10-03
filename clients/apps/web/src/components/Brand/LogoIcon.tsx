import { twMerge } from 'tailwind-merge'

const LogoIcon = ({
  className,
  size = 18,
}: {
  className?: string
  size?: number
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={twMerge(className ? className : '')}
    >
      <circle
        cx="9"
        cy="9"
        r="8.5"
        stroke="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
      <path
        d="M14.5 9C14.5 11.4003 13.8505 13.5508 12.8266 15.0866C11.8004 16.6259 10.4377 17.5 9 17.5C7.56234 17.5 6.19958 16.6259 5.17338 15.0866C4.14952 13.5508 3.5 11.4003 3.5 9C3.5 6.59966 4.14952 4.44918 5.17338 2.91339C6.19958 1.3741 7.56234 0.5 9 0.5C10.4377 0.5 11.8004 1.3741 12.8266 2.91339C13.8505 4.44918 14.5 6.59966 14.5 9Z"
        stroke="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
      <path
        d="M10.75 9C10.75 11.4567 10.5006 13.6641 10.1059 15.2427C9.90763 16.0359 9.67947 16.6423 9.44537 17.0383C9.19148 17.4679 9.02475 17.5 9 17.5C8.97525 17.5 8.80852 17.4679 8.55463 17.0383C8.32053 16.6423 8.09237 16.0359 7.89408 15.2427C7.49942 13.6641 7.25 11.4567 7.25 9C7.25 6.54329 7.49942 4.33594 7.89408 2.75731C8.09237 1.96415 8.32053 1.35775 8.55463 0.961679C8.80852 0.532141 8.97525 0.5 9 0.5C9.02475 0.5 9.19148 0.532141 9.44537 0.961679C9.67947 1.35775 9.90763 1.96415 10.1059 2.75731C10.5006 4.33594 10.75 6.54329 10.75 9Z"
        stroke="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default LogoIcon
