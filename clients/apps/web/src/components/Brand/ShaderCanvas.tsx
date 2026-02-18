'use client'

import React, { useEffect, useRef } from 'react'
import { setupWebGL, createRenderLoop, type Effect } from './shaders/core'
import { IMAGE_GLSL, loadImageTexture } from './shaders/geometry/image'

export type GeometrySource = string | { image: string }

export function ShaderCanvas({
  geometry,
  effect,
  className,
  children,
}: {
  geometry: GeometrySource
  effect: Effect
  className?: string
  children?: React.ReactNode
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const isImage = typeof geometry !== 'string'
    const geometryGlsl = isImage ? IMAGE_GLSL : geometry

    const fragmentSource = effect.buildShader(geometryGlsl)

    const handles = setupWebGL(canvas, fragmentSource, {
      premultipliedAlpha: false,
      alpha: true,
    })
    if (!handles) return

    const { gl, program } = handles

    const instance = effect.init(gl, program)

    // Image texture — loaded async, bound to TEXTURE1
    let imageTexture: WebGLTexture | null = null
    const geometryTextureLoc = isImage
      ? gl.getUniformLocation(program, 'u_geometryTexture')
      : null

    let cancelled = false

    if (isImage) {
      loadImageTexture(gl, geometry.image).then(({ texture }) => {
        if (cancelled) {
          gl.deleteTexture(texture)
          return
        }
        imageTexture = texture
      })
    }

    const cleanup = createRenderLoop({
      handles,
      canvas,
      colorA: effect.colorA,
      colorB: effect.colorB,
      darkColorA: effect.darkColorA,
      darkColorB: effect.darkColorB,
      colorDefaults: effect.colorDefaults,
      draw: (gl, time, colors) => {
        // Bind image texture to TEXTURE1 if available
        if (isImage && imageTexture && geometryTextureLoc) {
          gl.activeTexture(gl.TEXTURE1)
          gl.bindTexture(gl.TEXTURE_2D, imageTexture)
          gl.uniform1i(geometryTextureLoc, 1)
        }

        instance.draw(gl, canvas, time, colors)
      },
    })

    return () => {
      cancelled = true
      cleanup()
      instance.cleanup?.()
      if (imageTexture) gl.deleteTexture(imageTexture)
    }
  }, [geometry, effect])

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {children && (
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}
