import * as React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

/*  Integration and compilation: @N8Programs
    Inspired by:
     https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shadowmap_pcss.html
     https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-17-efficient-soft-edged-shadows-using
     https://developer.download.nvidia.com/whitepapers/2008/PCSS_Integration.pdf
     https://github.com/mrdoob/three.js/blob/master/examples/webgl_shadowmap_pcss.html [spidersharma03]
     https://spline.design/
   Concept:
     https://www.gamedev.net/tutorials/programming/graphics/contact-hardening-soft-shadows-made-fast-r4906/
   Vogel Disk Implementation:
     https://www.shadertoy.com/view/4l3yRM [ashalah]
   High-Frequency Noise Implementation:
     https://www.shadertoy.com/view/tt3fDH [spawner64]
*/
const pcss = ({
  focus = 0,
  size = 25,
  samples = 10
} = {}) => `
#define PENUMBRA_FILTER_SIZE float(${size})
#define RGB_NOISE_FUNCTION(uv) (randRGB(uv))
vec3 randRGB(vec2 uv) {
  return vec3(
    fract(sin(dot(uv, vec2(12.75613, 38.12123))) * 13234.76575),
    fract(sin(dot(uv, vec2(19.45531, 58.46547))) * 43678.23431),
    fract(sin(dot(uv, vec2(23.67817, 78.23121))) * 93567.23423)
  );
}

vec3 lowPassRandRGB(vec2 uv) {
  // 3x3 convolution (average)
  // can be implemented as separable with an extra buffer for a total of 6 samples instead of 9
  vec3 result = vec3(0);
  result += RGB_NOISE_FUNCTION(uv + vec2(-1.0, -1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(-1.0,  0.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(-1.0, +1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2( 0.0, -1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2( 0.0,  0.0));
  result += RGB_NOISE_FUNCTION(uv + vec2( 0.0, +1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(+1.0, -1.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(+1.0,  0.0));
  result += RGB_NOISE_FUNCTION(uv + vec2(+1.0, +1.0));
  result *= 0.111111111; // 1.0 / 9.0
  return result;
}
vec3 highPassRandRGB(vec2 uv) {
  // by subtracting the low-pass signal from the original signal, we're being left with the high-pass signal
  // hp(x) = x - lp(x)
  return RGB_NOISE_FUNCTION(uv) - lowPassRandRGB(uv) + 0.5;
}


vec2 vogelDiskSample(int sampleIndex, int sampleCount, float angle) {
  const float goldenAngle = 2.399963f; // radians
  float r = sqrt(float(sampleIndex) + 0.5f) / sqrt(float(sampleCount));
  float theta = float(sampleIndex) * goldenAngle + angle;
  float sine = sin(theta);
  float cosine = cos(theta);
  return vec2(cosine, sine) * r;
}
float penumbraSize( const in float zReceiver, const in float zBlocker ) { // Parallel plane estimation
  return (zReceiver - zBlocker) / zBlocker;
}
float findBlocker(sampler2D shadowMap, vec2 uv, float compare, float angle) {
  float texelSize = 1.0 / float(textureSize(shadowMap, 0).x);
  float blockerDepthSum = float(${focus});
  float blockers = 0.0;

  int j = 0;
  vec2 offset = vec2(0.);
  float depth = 0.;

  #pragma unroll_loop_start
  for(int i = 0; i < ${samples}; i ++) {
    offset = (vogelDiskSample(j, ${samples}, angle) * texelSize) * 2.0 * PENUMBRA_FILTER_SIZE;
    depth = unpackRGBAToDepth( texture2D( shadowMap, uv + offset));
    if (depth < compare) {
      blockerDepthSum += depth;
      blockers++;
    }
    j++;
  }
  #pragma unroll_loop_end

  if (blockers > 0.0) {
    return blockerDepthSum / blockers;
  }
  return -1.0;
}

        
float vogelFilter(sampler2D shadowMap, vec2 uv, float zReceiver, float filterRadius, float angle) {
  float texelSize = 1.0 / float(textureSize(shadowMap, 0).x);
  float shadow = 0.0f;
  int j = 0;
  vec2 vogelSample = vec2(0.0);
  vec2 offset = vec2(0.0);
  #pragma unroll_loop_start
  for (int i = 0; i < ${samples}; i++) {
    vogelSample = vogelDiskSample(j, ${samples}, angle) * texelSize;
    offset = vogelSample * (1.0 + filterRadius * float(${size}));
    shadow += step( zReceiver, unpackRGBAToDepth( texture2D( shadowMap, uv + offset ) ) );
    j++;
  }
  #pragma unroll_loop_end
  return shadow * 1.0 / ${samples}.0;
}

float PCSS (sampler2D shadowMap, vec4 coords) {
  vec2 uv = coords.xy;
  float zReceiver = coords.z; // Assumed to be eye-space z in this code
  float angle = highPassRandRGB(gl_FragCoord.xy).r * PI2;
  float avgBlockerDepth = findBlocker(shadowMap, uv, zReceiver, angle);
  if (avgBlockerDepth == -1.0) {
    return 1.0;
  }
  float penumbraRatio = penumbraSize(zReceiver, avgBlockerDepth);
  return vogelFilter(shadowMap, uv, zReceiver, 1.25 * penumbraRatio, angle);
}`;
function reset(gl, scene, camera) {
  scene.traverse(object => {
    if (object.material) {
      gl.properties.remove(object.material);
      object.material.dispose == null || object.material.dispose();
    }
  });
  gl.info.programs.length = 0;
  gl.compile(scene, camera);
}
function SoftShadows({
  focus = 0,
  samples = 10,
  size = 25
}) {
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  React.useEffect(() => {
    const original = THREE.ShaderChunk.shadowmap_pars_fragment;
    THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace('#ifdef USE_SHADOWMAP', '#ifdef USE_SHADOWMAP\n' + pcss({
      size,
      samples,
      focus
    })).replace('#if defined( SHADOWMAP_TYPE_PCF )', '\nreturn PCSS(shadowMap, shadowCoord);\n#if defined( SHADOWMAP_TYPE_PCF )');
    reset(gl, scene, camera);
    return () => {
      THREE.ShaderChunk.shadowmap_pars_fragment = original;
      reset(gl, scene, camera);
    };
  }, [focus, size, samples]);
  return null;
}

export { SoftShadows };
