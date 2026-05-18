type UsageIconProps = {
  size?: number
}

export const UsageIcon = ({ size = 28 }: UsageIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M24 11.9961H18.24" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M20.4887 20.4831L16.4158 16.4102"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M12.0048 24.0022V18.2422" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M3.51752 20.4909L7.59045 16.418"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M5.76 11.9961H0" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M7.591 7.58465L3.51807 3.51172"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M12.0051 5.76V0" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M16.4167 7.59247L20.4896 3.51953"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
)
