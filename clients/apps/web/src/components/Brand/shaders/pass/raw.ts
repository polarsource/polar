import type { Effect, EffectInstance } from '../core'
import { FILM_GRAIN_GLSL, HASH_GLSL } from '../glsl'

function buildRawShader(geometryGlsl: string): string {
  return `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform vec2 u_contentSize;

    ${HASH_GLSL}
    ${FILM_GRAIN_GLSL}
    ${geometryGlsl}

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      uv.y = 1.0 - uv.y;
      float aspect = u_resolution.x / u_resolution.y;
      vec3 color = computeColor(uv, aspect, u_time);
      color += filmGrain(gl_FragCoord.xy, u_time) * 0.8;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
}

interface RawEffectOptions {
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
}

export function rawEffect(options: RawEffectOptions = {}): Effect {
  return {
    colorA: options.colorA,
    colorB: options.colorB,
    darkColorA: options.darkColorA,
    darkColorB: options.darkColorB,
    buildShader: buildRawShader,
    init(gl: WebGLRenderingContext, program: WebGLProgram): EffectInstance {
      const resLoc = gl.getUniformLocation(program, 'u_resolution')
      const timeLoc = gl.getUniformLocation(program, 'u_time')
      const colorALoc = gl.getUniformLocation(program, 'u_colorA')
      const colorBLoc = gl.getUniformLocation(program, 'u_colorB')
      return {
        draw(gl, canvas, time, colors) {
          gl.uniform2f(resLoc, canvas.width, canvas.height)
          gl.uniform1f(timeLoc, time)
          gl.uniform3f(colorALoc, colors.a[0], colors.a[1], colors.a[2])
          gl.uniform3f(colorBLoc, colors.b[0], colors.b[1], colors.b[2])
        },
      }
    },
  }
}
