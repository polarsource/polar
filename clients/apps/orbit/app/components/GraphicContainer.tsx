import type { ReactNode } from 'react'

/**
 * GraphicContainer — shared wrapper that controls the box for every
 * canvas-based graphic component. Sets the aspect ratio, background,
 * border-radius, and overflow clipping so children can just fill the
 * container with an `h-full w-full` canvas.
 */

interface GraphicContainerProps {
  children: ReactNode
}

export const GraphicContainer = ({ children }: GraphicContainerProps) => (
  <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-neutral-900">
    {children}
  </div>
)
