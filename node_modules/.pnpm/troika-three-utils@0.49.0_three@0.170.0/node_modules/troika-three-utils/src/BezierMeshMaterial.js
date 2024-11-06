import { createDerivedMaterial } from './DerivedMaterial.js'
import { Vector3 } from 'three'

/*
Input geometry is a cylinder with r=1, height in y dimension from 0 to 1,
divided into a reasonable number of height segments.
*/

const vertexDefs = `
uniform vec3 pointA;
uniform vec3 controlA;
uniform vec3 controlB;
uniform vec3 pointB;
uniform float radius;
varying float bezierT;

vec3 cubicBezier(vec3 p1, vec3 c1, vec3 c2, vec3 p2, float t) {
  float t2 = 1.0 - t;
  float b0 = t2 * t2 * t2;
  float b1 = 3.0 * t * t2 * t2;
  float b2 = 3.0 * t * t * t2;
  float b3 = t * t * t;
  return b0 * p1 + b1 * c1 + b2 * c2 + b3 * p2;
}

vec3 cubicBezierDerivative(vec3 p1, vec3 c1, vec3 c2, vec3 p2, float t) {
  float t2 = 1.0 - t;
  return -3.0 * p1 * t2 * t2 +
    c1 * (3.0 * t2 * t2 - 6.0 * t2 * t) +
    c2 * (6.0 * t2 * t - 3.0 * t * t) +
    3.0 * p2 * t * t;
}
`

const vertexTransform = `
float t = position.y;
bezierT = t;
vec3 bezierCenterPos = cubicBezier(pointA, controlA, controlB, pointB, t);
vec3 bezierDir = normalize(cubicBezierDerivative(pointA, controlA, controlB, pointB, t));

// Make "sideways" always perpendicular to the camera ray; this ensures that any twists
// in the cylinder occur where you won't see them: 
vec3 viewDirection = normalMatrix * vec3(0.0, 0.0, 1.0);
if (bezierDir == viewDirection) {
  bezierDir = normalize(cubicBezierDerivative(pointA, controlA, controlB, pointB, t == 1.0 ? t - 0.0001 : t + 0.0001));
}
vec3 sideways = normalize(cross(bezierDir, viewDirection));
vec3 upish = normalize(cross(sideways, bezierDir));

// Build a matrix for transforming this disc in the cylinder:
mat4 discTx;
discTx[0].xyz = sideways * radius;
discTx[1].xyz = bezierDir * radius;
discTx[2].xyz = upish * radius;
discTx[3].xyz = bezierCenterPos;
discTx[3][3] = 1.0;

// Apply transform, ignoring original y
position = (discTx * vec4(position.x, 0.0, position.z, 1.0)).xyz;
normal = normalize(mat3(discTx) * normal);
`

const fragmentDefs = `
uniform vec3 dashing;
varying float bezierT;
`

const fragmentMainIntro = `
if (dashing.x + dashing.y > 0.0) {
  float dashFrac = mod(bezierT - dashing.z, dashing.x + dashing.y);
  if (dashFrac > dashing.x) {
    discard;
  }
}
`

// Debugging: separate color for each of the 6 sides:
// const fragmentColorTransform = `
// float sideNum = floor(vUV.x * 6.0);
// vec3 mixColor = sideNum < 1.0 ? vec3(1.0, 0.0, 0.0) :
//   sideNum < 2.0 ? vec3(0.0, 1.0, 1.0) :
//   sideNum < 3.0 ? vec3(1.0, 1.0, 0.0) :
//   sideNum < 4.0 ? vec3(0.0, 0.0, 1.0) :
//   sideNum < 5.0 ? vec3(0.0, 1.0, 0.0) :
//   vec3(1.0, 0.0, 1.0);
// gl_FragColor.xyz = mix(gl_FragColor.xyz, mixColor, 0.5);
// `



export function createBezierMeshMaterial(baseMaterial) {
  return createDerivedMaterial(
    baseMaterial,
    {
      chained: true,
      uniforms: {
        pointA: {value: new Vector3()},
        controlA: {value: new Vector3()},
        controlB: {value: new Vector3()},
        pointB: {value: new Vector3()},
        radius: {value: 0.01},
        dashing: {value: new Vector3()} //on, off, offset
      },
      vertexDefs,
      vertexTransform,
      fragmentDefs,
      fragmentMainIntro
    }
  )
}
