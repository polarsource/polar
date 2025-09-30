const NextJsIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <svg
      aria-label="Next.js logomark"
      className="next-mark_root__iLw9v"
      role="img"
      viewBox="40 40 120 120"
      width={size}
    >
      <mask
        height="180"
        id=":S3:mask0_408_134"
        maskUnits="userSpaceOnUse"
        width="180"
        x="0"
        y="0"
        style={{ maskType: 'alpha' }}
      >
        <circle cx="90" cy="90" r="90"></circle>
      </mask>
      <g mask="url(#:S3:mask0_408_134)">
        <path
          d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z"
          fill="url(#:S3:paint0_linear_408_134)"
        ></path>
        <rect
          fill="url(#:S3:paint1_linear_408_134)"
          height="72"
          width="12"
          x="115"
          y="54"
        ></rect>
      </g>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id=":S3:paint0_linear_408_134"
          x1="109"
          x2="144.5"
          y1="116.5"
          y2="160.5"
        >
          <stop stopColor="currentColor"></stop>
          <stop offset="1" stopColor="currentColor" stopOpacity="0"></stop>
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id=":S3:paint1_linear_408_134"
          x1="121"
          x2="120.799"
          y1="54"
          y2="106.875"
        >
          <stop stopColor="currentColor"></stop>
          <stop offset="1" stopColor="currentColor" stopOpacity="0"></stop>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default NextJsIcon
