'use client'

import { useEffect, useRef } from 'react'
import {
  createRenderLoop,
  setupWebGL,
  type ColorDefaults,
} from './shaders/core'
import { WAVES_GLSL } from './shaders/geometry/waves'
import {
  buildDitherShader,
  getDitherUniformLocations,
  setupDitherUniforms,
} from './shaders/pass/dither'

export function DitherShader({
  className,
  colorA,
  colorB,
  darkColorA,
  darkColorB,
  pixelSize = 4,
}: {
  className?: string
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
  pixelSize?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const fragmentSource = buildDitherShader(WAVES_GLSL, {
      filmGrain: false,
      thresholdBias: 0,
    })

    const handles = setupWebGL(canvas, fragmentSource)
    if (!handles) return

    const locs = getDitherUniformLocations(handles.gl, handles.program)

    const colorDefaults: ColorDefaults = {
      light: { a: '#000000', b: '#ffffff' },
      dark: { a: '#ffffff', b: '#000000' },
    }

    const cleanup = createRenderLoop({
      handles,
      canvas,
      colorA,
      colorB,
      darkColorA,
      darkColorB,
      colorDefaults,
      draw: (gl, time, colors) => {
        setupDitherUniforms(gl, locs, canvas, time, colors, pixelSize)
      },
    })

    return cleanup
  }, [colorA, colorB, darkColorA, darkColorB, pixelSize])

  return <canvas ref={canvasRef} className={className} />
}
