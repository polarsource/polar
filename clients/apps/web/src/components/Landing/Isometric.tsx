'use client'

import { CSSProperties, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

// ── Scene wrapper ─────────────────────────────────────────────────────────────

type IsometricProps = PropsWithChildren<{
  className?: string
  style?: CSSProperties
}>

/**
 * Wraps children in a CSS 3D isometric projection.
 * Uses rotateX(60deg) rotateZ(45deg) to achieve a top-right isometric view.
 */
export const Isometric = ({ children, className, style }: IsometricProps) => (
  <div
    className={twMerge('relative', className)}
    style={{
      transformStyle: 'preserve-3d',
      transform: 'rotateX(60deg) rotateZ(45deg)',
      ...style,
    }}
  >
    {children}
  </div>
)

// ── Box primitive ─────────────────────────────────────────────────────────────

type IsometricBoxProps = PropsWithChildren & {
  /** Position in scene (px) */
  x?: number
  y?: number
  z?: number
  /** X extent */
  width: number
  /** Y extent (scene depth) */
  height: number
  /** Z extent (extrusion upward) */
  depth: number
  /** Per-face style overrides */
  topStyle?: CSSProperties
  frontStyle?: CSSProperties
  rightStyle?: CSSProperties
  topClassName?: string
  frontClassName?: string
  rightClassName?: string
  className?: string
}

/**
 * Renders an extruded rectangular box with three visible faces inside an
 * Isometric scene: top (XY plane), front (Y-facing), and right (X-facing).
 */
export const IsometricBox = ({
  x = 0,
  y = 0,
  z = 0,
  width,
  height,
  depth,
  topStyle,
  frontStyle,
  rightStyle,
  topClassName,
  frontClassName,
  rightClassName,
  className,
  children,
}: IsometricBoxProps) => (
  <div
    className={twMerge('absolute', className)}
    style={{
      left: x,
      top: y,
      width,
      height,
      transformStyle: 'preserve-3d',
      transform: `translateZ(${z}px)`,
    }}
  >
    {/* Top face — XY plane at z = depth */}
    <div
      className={twMerge('absolute inset-0', topClassName)}
      style={{ transform: `translateZ(${depth}px)`, ...topStyle }}
    >
      {children}
    </div>
    {/* Front face — at y = height, rotated into the YZ plane */}
    <div
      className={twMerge('absolute', frontClassName)}
      style={{
        left: 0,
        top: height,
        width,
        height: depth,
        transformOrigin: 'top',
        transform: 'rotateX(90deg)',
        ...frontStyle,
      }}
    />
    {/* Right face — at x = width, rotated into the XZ plane */}
    <div
      className={twMerge('absolute', rightClassName)}
      style={{
        left: width,
        top: 0,
        width: depth,
        height,
        transformOrigin: 'left',
        transform: 'rotateY(-90deg)',
        ...rightStyle,
      }}
    />
  </div>
)
