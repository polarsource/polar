import type { ReactNode } from 'react'

/**
 * The head of a destination page: a 1920 by 1080 drawing in the same rounded night box as the usage billing film.
 */
export function Stage({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#111111]"
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 1920 1080"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {children}
      </svg>
    </div>
  )
}
