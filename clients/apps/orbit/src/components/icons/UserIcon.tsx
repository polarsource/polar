type UserIconProps = {
  size?: number
}

export const UserIcon = ({ size = 22 }: UserIconProps) => {
  const height = size
  const width = (18 / 35) * size
  return (
    <svg
      width={width}
      height={height}
      viewBox="-2 -2 18 35"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1 31L1 24C1 20.6863 3.68629 18 7 18C10.3137 18 13 20.6863 13 24L13 31"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="3" />
    </svg>
  )
}
