'use client'
import { Box } from '@polar-sh/orbit/Box'

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
  <Box
    style={{
      transformStyle: 'preserve-3d',
      transform: 'rotateX(60deg) rotateZ(45deg)',
      ...style,
    }}
    className={twMerge('relative', className)}
  >
    {children}
  </Box>
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
  <Box
    style={{
      left: x,
      top: y,
      width,
      height,
      transformStyle: 'preserve-3d',
      transform: `translateZ(${z}px)`,
    }}
    className={twMerge('absolute', className)}
  >
    {/* Top face — XY plane at z = depth */}
    <Box
      style={{ transform: `translateZ(${depth}px)`, ...topStyle }}
      className={twMerge('absolute inset-0', topClassName)}
    >
      {children}
    </Box>
    {/* Front face — at y = height, rotated into the YZ plane */}
    <Box
      style={{
        left: 0,
        top: height,
        width,
        height: depth,
        transformOrigin: 'top',
        transform: 'rotateX(90deg)',
        ...frontStyle,
      }}
      className={twMerge('absolute', frontClassName)}
    />
    {/* Right face — at x = width, rotated into the XZ plane */}
    <Box
      style={{
        left: width,
        top: 0,
        width: depth,
        height,
        transformOrigin: 'left',
        transform: 'rotateY(-90deg)',
        ...rightStyle,
      }}
      className={twMerge('absolute', rightClassName)}
    />
  </Box>
)
