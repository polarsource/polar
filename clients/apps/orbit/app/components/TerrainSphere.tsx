"use client";

import { useEffect, useRef } from "react";
import { GraphicContainer } from "./GraphicContainer";

/**
 * TerrainSphere — a 3D sphere split into two halves, rendered as
 * horizontal contour slices via WebGL. A noise-based terrain scrolls
 * through the interior, visible where it intersects each slice.
 * The whole assembly slowly rotates.
 */

const VS = /* glsl */ `
attribute vec2 a_quad;
uniform float u_sliceZ;
uniform vec2  u_halfXY;
uniform float u_viewScale;
uniform float u_depthScale;
uniform float u_yaw;
uniform float u_pitch;

varying vec2 v_world;

void main() {
  vec2 xy = a_quad * u_halfXY * 2.0;
  v_world = xy;

  float cY = cos(u_yaw), sY = sin(u_yaw);
  float cP = cos(u_pitch), sP = sin(u_pitch);

  float x1 = xy.x * cY + xy.y * sY;
  float y1 = -xy.x * sY + xy.y * cY;
  float y2 = y1 * cP - u_sliceZ * sP;

  gl_Position = vec4(
    x1 * u_viewScale,
    y2 * u_viewScale,
    -u_sliceZ * u_depthScale,
    1.0
  );
}
`;

const FS = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform float u_time;
uniform float u_sliceZ;
uniform float u_sphereR;
uniform vec3  u_lineColor;

varying vec2 v_world;

// 2D value noise
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}
float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  return noise2D(p) * 0.6 + noise2D(p * 2.1 + 3.7) * 0.3 + noise2D(p * 4.3 + 1.2) * 0.1;
}

void main() {
  vec3 p = vec3(v_world, u_sliceZ);

  // Sphere SDF
  float sphereDist = length(p) - u_sphereR;

  // Outside sphere → discard
  if (sphereDist > 0.0) discard;

  // Terrain heightfield: z = amplitude * fbm(x, y)
  float terrainH = (fbm(v_world * 2.5 + vec2(u_time * 0.3, 0.0)) - 0.5) * u_sphereR * 1.2;
  float terrainDist = u_sliceZ - terrainH;

  // Sphere contour
  vec2 gs = vec2(dFdx(sphereDist), dFdy(sphereDist));
  float sPx = abs(sphereDist) / max(length(gs), 1e-4);
  float sLine = 1.0 - smoothstep(0.4, 1.2, sPx);

  // Terrain contour (only inside sphere)
  vec2 gt = vec2(dFdx(terrainDist), dFdy(terrainDist));
  float tPx = abs(terrainDist) / max(length(gt), 1e-4);
  float tLine = 1.0 - smoothstep(0.4, 1.2, tPx);

  float line = max(sLine, tLine);

  if (line > 0.02) {
    gl_FragColor = vec4(u_lineColor, line);
  } else {
    // Inside sphere — write depth only for occlusion
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  }
}
`;

const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
  return s;
};

const link = (gl: WebGLRenderingContext, vs: string, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? "link error");
  return p;
};

export const TerrainSphere = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true, premultipliedAlpha: false, depth: true, antialias: true,
    });
    if (!gl) return;
    gl.getExtension("OES_standard_derivatives");

    const dpr = window.devicePixelRatio ?? 1;
    const resize = () => {
      const w = canvas.offsetWidth * dpr;
      const h = canvas.offsetHeight * dpr;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const prog = link(gl, VS, FS);
    gl.useProgram(prog);

    const loc = (n: string) => gl.getUniformLocation(prog, n);
    const uSliceZ = loc("u_sliceZ");
    const uHalfXY = loc("u_halfXY");
    const uViewScale = loc("u_viewScale");
    const uDepthScale = loc("u_depthScale");
    const uYaw = loc("u_yaw");
    const uPitch = loc("u_pitch");
    const uTime = loc("u_time");
    const uSphereR = loc("u_sphereR");
    const uLineColor = loc("u_lineColor");

    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5,
    ]), gl.STATIC_DRAW);
    const aQuad = gl.getAttribLocation(prog, "a_quad");
    gl.enableVertexAttribArray(aQuad);
    gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const R = 0.55;
    const halfXY = 0.62;
    const sliceCount = 32;
    const gap = 0.06; // gap between halves

    gl.uniform2f(uHalfXY, halfXY, halfXY);
    gl.uniform1f(uViewScale, 0.95);
    gl.uniform1f(uDepthScale, 0.5);
    gl.uniform1f(uSphereR, R);
    gl.uniform3f(uLineColor, 190 / 255, 190 / 255, 190 / 255);

    const seed = Math.random() * 100;
    let lastTime: number | null = null;
    let time = 0;

    const frame = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      time += dt;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.uniform1f(uTime, time + seed);
      gl.uniform1f(uYaw, time * 0.15);
      gl.uniform1f(uPitch, -0.55);

      // Render slices front-to-back, skipping the gap
      for (let s = sliceCount - 1; s >= 0; s--) {
        const t = s / (sliceCount - 1);
        const z = -R + t * R * 2;

        // Skip the gap between halves
        if (Math.abs(z) < gap) continue;

        gl.uniform1f(uSliceZ, z);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      gl.deleteBuffer(quadBuf);
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  );
};
