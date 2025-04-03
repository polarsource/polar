import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const AVATAR_COLOR_PAIRS = [
  [85.2, 50, 21.57], // Pastel Pink
  [89.5, 50, 134.2], // Pastel Green
  [87.3, 50, 208.4], // Pastel Blue
  [86.8, 50, 35.6], // Pastel Orange
  [92.1, 50, 60.3], // Pastel Yellow
  [84.9, 50, 280.1], // Pastel Purple
  [85.4, 50, 0.0], // Pastel Red
  [90.2, 50, 147.8], // Pastel Mint
  [88.7, 50, 240.5], // Pastel Periwinkle
  [86.5, 50, 348.2], // Pastel Rose
] as const

const computeGradient = (color: (typeof AVATAR_COLOR_PAIRS)[number]) => {
  const analogousColor1 = (color[2] - 80) % 360
  const analogousColor2 = (color[2] + 80) % 360
  return {
    backgroundImage: `linear-gradient(45deg, oklch(${color[0]}% ${color[1]}% ${analogousColor1}deg), oklch(${color[0]}% ${color[1]}% ${color[2]}deg), oklch(${color[0]}% ${color[1]}% ${analogousColor2}deg))`,
    backgroundSize: '200% 200%',
  }
}

const Avatar = ({
  name,
  avatar_url,
  className,
  height,
  width,
}: {
  name: string
  avatar_url: string | null
  className?: string
  height?: number | undefined
  width?: number | undefined
}) => {
  const color = useMemo(
    () =>
      AVATAR_COLOR_PAIRS[
        (name.charCodeAt(0) + new Date().getMinutes()) %
          AVATAR_COLOR_PAIRS.length
      ],
    [name],
  )

  const gradient = computeGradient(color)
  return (
    <div
      className={twMerge(
        'animate-gradient relative z-[2] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm',
        className,
      )}
      style={{
        ...gradient,
      }}
    >
      {avatar_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={name}
            src={avatar_url}
            height={height}
            width={width}
            className="z-[1] aspect-square rounded-full object-cover"
          />
        </>
      )}
    </div>
  )
}

export default Avatar
