import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { useFBO } from './Fbo.js';
import { useHelper } from './Helper.js';
import { shaderMaterial } from './shaderMaterial.js';
import { Edges } from './Edges.js';
import { FullScreenQuad } from 'three-stdlib';
import { version } from '../helpers/constants.js';

function createNormalMaterial(side = THREE.FrontSide) {
  const viewMatrix = {
    value: new THREE.Matrix4()
  };
  return Object.assign(new THREE.MeshNormalMaterial({
    side
  }), {
    viewMatrix,
    onBeforeCompile: shader => {
      shader.uniforms.viewMatrix = viewMatrix;
      shader.fragmentShader = `vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
           return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
         }\n` + shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
           normal = inverseTransformDirection( normal, viewMatrix );\n`);
    }
  });
}
const CausticsProjectionMaterial = /* @__PURE__ */shaderMaterial({
  causticsTexture: null,
  causticsTextureB: null,
  color: /* @__PURE__ */new THREE.Color(),
  lightProjMatrix: /* @__PURE__ */new THREE.Matrix4(),
  lightViewMatrix: /* @__PURE__ */new THREE.Matrix4()
}, `varying vec3 vWorldPosition;
   void main() {
     gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.);
     vec4 worldPosition = modelMatrix * vec4(position, 1.);
     vWorldPosition = worldPosition.xyz;
   }`, `varying vec3 vWorldPosition;
  uniform vec3 color;
  uniform sampler2D causticsTexture;
  uniform sampler2D causticsTextureB;
  uniform mat4 lightProjMatrix;
  uniform mat4 lightViewMatrix;
   void main() {
    // Apply caustics
    vec4 lightSpacePos = lightProjMatrix * lightViewMatrix * vec4(vWorldPosition, 1.0);
    lightSpacePos.xyz /= lightSpacePos.w;
    lightSpacePos.xyz = lightSpacePos.xyz * 0.5 + 0.5;
    vec3 front = texture2D(causticsTexture, lightSpacePos.xy).rgb;
    vec3 back = texture2D(causticsTextureB, lightSpacePos.xy).rgb;
    gl_FragColor = vec4((front + back) * color, 1.0);
    #include <tonemapping_fragment>
    #include <${version >= 154 ? 'colorspace_fragment' : 'encodings_fragment'}>
   }`);
const CausticsMaterial = /* @__PURE__ */shaderMaterial({
  cameraMatrixWorld: /* @__PURE__ */new THREE.Matrix4(),
  cameraProjectionMatrixInv: /* @__PURE__ */new THREE.Matrix4(),
  normalTexture: null,
  depthTexture: null,
  lightDir: /* @__PURE__ */new THREE.Vector3(0, 1, 0),
  lightPlaneNormal: /* @__PURE__ */new THREE.Vector3(0, 1, 0),
  lightPlaneConstant: 0,
  near: 0.1,
  far: 100,
  modelMatrix: /* @__PURE__ */new THREE.Matrix4(),
  worldRadius: 1 / 40,
  ior: 1.1,
  bounces: 0,
  resolution: 1024,
  size: 10,
  intensity: 0.5
}, /* glsl */`
  varying vec2 vUv;
  void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`, /* glsl */`
  uniform mat4 cameraMatrixWorld;
  uniform mat4 cameraProjectionMatrixInv;
  uniform vec3 lightDir;
  uniform vec3 lightPlaneNormal;
  uniform float lightPlaneConstant;
  uniform float near;
  uniform float far;
  uniform float time;
  uniform float worldRadius;
  uniform float resolution;
  uniform float size;
  uniform float intensity;
  uniform float ior;
  precision highp isampler2D;
  precision highp usampler2D;
  uniform sampler2D normalTexture;
  uniform sampler2D depthTexture;
  uniform float bounces;
  varying vec2 vUv;
  vec3 WorldPosFromDepth(float depth, vec2 coord) {
    float z = depth * 2.0 - 1.0;
    vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = cameraProjectionMatrixInv * clipSpacePosition;
    // Perspective division
    viewSpacePosition /= viewSpacePosition.w;
    vec4 worldSpacePosition = cameraMatrixWorld * viewSpacePosition;
    return worldSpacePosition.xyz;
  }
  float sdPlane( vec3 p, vec3 n, float h ) {
    // n must be normalized
    return dot(p,n) + h;
  }
  float planeIntersect( vec3 ro, vec3 rd, vec4 p ) {
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
  }
  vec3 totalInternalReflection(vec3 ro, vec3 rd, vec3 pos, vec3 normal, float ior, out vec3 rayOrigin, out vec3 rayDirection) {
    rayOrigin = ro;
    rayDirection = rd;
    rayDirection = refract(rayDirection, normal, 1.0 / ior);
    rayOrigin = pos + rayDirection * 0.1;
    return rayDirection;
  }
  void main() {
    // Each sample consists of random offset in the x and y direction
    float caustic = 0.0;
    float causticTexelSize = (1.0 / resolution) * size * 2.0;
    float texelsNeeded = worldRadius / causticTexelSize;
    float sampleRadius = texelsNeeded / resolution;
    float sum = 0.0;
    if (texture2D(depthTexture, vUv).x == 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec2 offset1 = vec2(-0.5, -0.5);//vec2(rand() - 0.5, rand() - 0.5);
    vec2 offset2 = vec2(-0.5, 0.5);//vec2(rand() - 0.5, rand() - 0.5);
    vec2 offset3 = vec2(0.5, 0.5);//vec2(rand() - 0.5, rand() - 0.5);
    vec2 offset4 = vec2(0.5, -0.5);//vec2(rand() - 0.5, rand() - 0.5);
    vec2 uv1 = vUv + offset1 * sampleRadius;
    vec2 uv2 = vUv + offset2 * sampleRadius;
    vec2 uv3 = vUv + offset3 * sampleRadius;
    vec2 uv4 = vUv + offset4 * sampleRadius;
    vec3 normal1 = texture2D(normalTexture, uv1, -10.0).rgb * 2.0 - 1.0;
    vec3 normal2 = texture2D(normalTexture, uv2, -10.0).rgb * 2.0 - 1.0;
    vec3 normal3 = texture2D(normalTexture, uv3, -10.0).rgb * 2.0 - 1.0;
    vec3 normal4 = texture2D(normalTexture, uv4, -10.0).rgb * 2.0 - 1.0;
    float depth1 = texture2D(depthTexture, uv1, -10.0).x;
    float depth2 = texture2D(depthTexture, uv2, -10.0).x;
    float depth3 = texture2D(depthTexture, uv3, -10.0).x;
    float depth4 = texture2D(depthTexture, uv4, -10.0).x;
    // Sanity check the depths
    if (depth1 == 1.0 || depth2 == 1.0 || depth3 == 1.0 || depth4 == 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec3 pos1 = WorldPosFromDepth(depth1, uv1);
    vec3 pos2 = WorldPosFromDepth(depth2, uv2);
    vec3 pos3 = WorldPosFromDepth(depth3, uv3);
    vec3 pos4 = WorldPosFromDepth(depth4, uv4);
    vec3 originPos1 = WorldPosFromDepth(0.0, uv1);
    vec3 originPos2 = WorldPosFromDepth(0.0, uv2);
    vec3 originPos3 = WorldPosFromDepth(0.0, uv3);
    vec3 originPos4 = WorldPosFromDepth(0.0, uv4);
    vec3 endPos1, endPos2, endPos3, endPos4;
    vec3 endDir1, endDir2, endDir3, endDir4;
    totalInternalReflection(originPos1, lightDir, pos1, normal1, ior, endPos1, endDir1);
    totalInternalReflection(originPos2, lightDir, pos2, normal2, ior, endPos2, endDir2);
    totalInternalReflection(originPos3, lightDir, pos3, normal3, ior, endPos3, endDir3);
    totalInternalReflection(originPos4, lightDir, pos4, normal4, ior, endPos4, endDir4);
    float lightPosArea = length(cross(originPos2 - originPos1, originPos3 - originPos1)) + length(cross(originPos3 - originPos1, originPos4 - originPos1));
    float t1 = planeIntersect(endPos1, endDir1, vec4(lightPlaneNormal, lightPlaneConstant));
    float t2 = planeIntersect(endPos2, endDir2, vec4(lightPlaneNormal, lightPlaneConstant));
    float t3 = planeIntersect(endPos3, endDir3, vec4(lightPlaneNormal, lightPlaneConstant));
    float t4 = planeIntersect(endPos4, endDir4, vec4(lightPlaneNormal, lightPlaneConstant));
    vec3 finalPos1 = endPos1 + endDir1 * t1;
    vec3 finalPos2 = endPos2 + endDir2 * t2;
    vec3 finalPos3 = endPos3 + endDir3 * t3;
    vec3 finalPos4 = endPos4 + endDir4 * t4;
    float finalArea = length(cross(finalPos2 - finalPos1, finalPos3 - finalPos1)) + length(cross(finalPos3 - finalPos1, finalPos4 - finalPos1));
    caustic += intensity * (lightPosArea / finalArea);
    // Calculate the area of the triangle in light spaces
    gl_FragColor = vec4(vec3(max(caustic, 0.0)), 1.0);
  }`);
const NORMALPROPS = {
  depth: true,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  type: THREE.UnsignedByteType
};
const CAUSTICPROPS = {
  minFilter: THREE.LinearMipmapLinearFilter,
  magFilter: THREE.LinearFilter,
  type: THREE.FloatType,
  generateMipmaps: true
};
const Caustics = /* @__PURE__ */React.forwardRef(({
  debug,
  children,
  frames = 1,
  ior = 1.1,
  color = 'white',
  causticsOnly = false,
  backside = false,
  backsideIOR = 1.1,
  worldRadius = 0.3125,
  intensity = 0.05,
  resolution = 2024,
  lightSource = [5, 5, 5],
  ...props
}, fref) => {
  extend({
    CausticsProjectionMaterial
  });
  const ref = React.useRef(null);
  const camera = React.useRef(null);
  const scene = React.useRef(null);
  const plane = React.useRef(null);
  const gl = useThree(state => state.gl);
  const helper = useHelper(debug && camera, THREE.CameraHelper);

  // Buffers for front and back faces
  const normalTarget = useFBO(resolution, resolution, NORMALPROPS);
  const normalTargetB = useFBO(resolution, resolution, NORMALPROPS);
  const causticsTarget = useFBO(resolution, resolution, CAUSTICPROPS);
  const causticsTargetB = useFBO(resolution, resolution, CAUSTICPROPS);
  // Normal materials for front and back faces
  const [normalMat] = React.useState(() => createNormalMaterial());
  const [normalMatB] = React.useState(() => createNormalMaterial(THREE.BackSide));
  // The quad that catches the caustics
  const [causticsMaterial] = React.useState(() => new CausticsMaterial());
  const [causticsQuad] = React.useState(() => new FullScreenQuad(causticsMaterial));
  React.useLayoutEffect(() => {
    ref.current.updateWorldMatrix(false, true);
  });
  let count = 0;
  const v = new THREE.Vector3();
  const lpF = new THREE.Frustum();
  const lpM = new THREE.Matrix4();
  const lpP = new THREE.Plane();
  const lightDir = new THREE.Vector3();
  const lightDirInv = new THREE.Vector3();
  const bounds = new THREE.Box3();
  const focusPos = new THREE.Vector3();
  const boundsVertices = [];
  const worldVerts = [];
  const projectedVerts = [];
  const lightDirs = [];
  const cameraPos = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    boundsVertices.push(new THREE.Vector3());
    worldVerts.push(new THREE.Vector3());
    projectedVerts.push(new THREE.Vector3());
    lightDirs.push(new THREE.Vector3());
  }
  useFrame(() => {
    if (frames === Infinity || count++ < frames) {
      var _scene$current$parent, _helper$current;
      if (Array.isArray(lightSource)) lightDir.fromArray(lightSource).normalize();else lightDir.copy(ref.current.worldToLocal(lightSource.current.getWorldPosition(v)).normalize());
      lightDirInv.copy(lightDir).multiplyScalar(-1);
      (_scene$current$parent = scene.current.parent) == null || _scene$current$parent.matrixWorld.identity();
      bounds.setFromObject(scene.current, true);
      boundsVertices[0].set(bounds.min.x, bounds.min.y, bounds.min.z);
      boundsVertices[1].set(bounds.min.x, bounds.min.y, bounds.max.z);
      boundsVertices[2].set(bounds.min.x, bounds.max.y, bounds.min.z);
      boundsVertices[3].set(bounds.min.x, bounds.max.y, bounds.max.z);
      boundsVertices[4].set(bounds.max.x, bounds.min.y, bounds.min.z);
      boundsVertices[5].set(bounds.max.x, bounds.min.y, bounds.max.z);
      boundsVertices[6].set(bounds.max.x, bounds.max.y, bounds.min.z);
      boundsVertices[7].set(bounds.max.x, bounds.max.y, bounds.max.z);
      for (let i = 0; i < 8; i++) {
        worldVerts[i].copy(boundsVertices[i]);
      }
      bounds.getCenter(focusPos);
      boundsVertices.map(v => v.sub(focusPos));
      const lightPlane = lpP.set(lightDirInv, 0);
      boundsVertices.map((v, i) => lightPlane.projectPoint(v, projectedVerts[i]));
      const centralVert = projectedVerts.reduce((a, b) => a.add(b), v.set(0, 0, 0)).divideScalar(projectedVerts.length);
      const radius = projectedVerts.map(v => v.distanceTo(centralVert)).reduce((a, b) => Math.max(a, b));
      const dirLength = boundsVertices.map(x => x.dot(lightDir)).reduce((a, b) => Math.max(a, b));
      // Shadows
      camera.current.position.copy(cameraPos.copy(lightDir).multiplyScalar(dirLength).add(focusPos));
      camera.current.lookAt(scene.current.localToWorld(focusPos));
      const dirMatrix = lpM.lookAt(camera.current.position, focusPos, v.set(0, 1, 0));
      camera.current.left = -radius;
      camera.current.right = radius;
      camera.current.top = radius;
      camera.current.bottom = -radius;
      const yOffset = v.set(0, radius, 0).applyMatrix4(dirMatrix);
      const yTime = (camera.current.position.y + yOffset.y) / lightDir.y;
      camera.current.near = 0.1;
      camera.current.far = yTime;
      camera.current.updateProjectionMatrix();
      camera.current.updateMatrixWorld();

      // Now find size of ground plane
      const groundProjectedCoords = worldVerts.map((v, i) => v.add(lightDirs[i].copy(lightDir).multiplyScalar(-v.y / lightDir.y)));
      const centerPos = groundProjectedCoords.reduce((a, b) => a.add(b), v.set(0, 0, 0)).divideScalar(groundProjectedCoords.length);
      const maxSize = 2 * groundProjectedCoords.map(v => Math.hypot(v.x - centerPos.x, v.z - centerPos.z)).reduce((a, b) => Math.max(a, b));
      plane.current.scale.setScalar(maxSize);
      plane.current.position.copy(centerPos);
      if (debug) (_helper$current = helper.current) == null || _helper$current.update();

      // Inject uniforms
      normalMatB.viewMatrix.value = normalMat.viewMatrix.value = camera.current.matrixWorldInverse;
      const dirLightNearPlane = lpF.setFromProjectionMatrix(lpM.multiplyMatrices(camera.current.projectionMatrix, camera.current.matrixWorldInverse)).planes[4];
      causticsMaterial.cameraMatrixWorld = camera.current.matrixWorld;
      causticsMaterial.cameraProjectionMatrixInv = camera.current.projectionMatrixInverse;
      causticsMaterial.lightDir = lightDirInv;
      causticsMaterial.lightPlaneNormal = dirLightNearPlane.normal;
      causticsMaterial.lightPlaneConstant = dirLightNearPlane.constant;
      causticsMaterial.near = camera.current.near;
      causticsMaterial.far = camera.current.far;
      causticsMaterial.resolution = resolution;
      causticsMaterial.size = radius;
      causticsMaterial.intensity = intensity;
      causticsMaterial.worldRadius = worldRadius;

      // Switch the scene on
      scene.current.visible = true;

      // Render front face normals
      gl.setRenderTarget(normalTarget);
      gl.clear();
      scene.current.overrideMaterial = normalMat;
      gl.render(scene.current, camera.current);

      // Render back face normals, if enabled
      gl.setRenderTarget(normalTargetB);
      gl.clear();
      if (backside) {
        scene.current.overrideMaterial = normalMatB;
        gl.render(scene.current, camera.current);
      }

      // Remove the override material
      scene.current.overrideMaterial = null;

      // Render front face caustics
      causticsMaterial.ior = ior;
      plane.current.material.lightProjMatrix = camera.current.projectionMatrix;
      plane.current.material.lightViewMatrix = camera.current.matrixWorldInverse;
      causticsMaterial.normalTexture = normalTarget.texture;
      causticsMaterial.depthTexture = normalTarget.depthTexture;
      gl.setRenderTarget(causticsTarget);
      gl.clear();
      causticsQuad.render(gl);

      // Render back face caustics, if enabled
      causticsMaterial.ior = backsideIOR;
      causticsMaterial.normalTexture = normalTargetB.texture;
      causticsMaterial.depthTexture = normalTargetB.depthTexture;
      gl.setRenderTarget(causticsTargetB);
      gl.clear();
      if (backside) causticsQuad.render(gl);

      // Reset render target
      gl.setRenderTarget(null);

      // Switch the scene off if caustics is all that's wanted
      if (causticsOnly) scene.current.visible = false;
    }
  });
  React.useImperativeHandle(fref, () => ref.current, []);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, props), /*#__PURE__*/React.createElement("scene", {
    ref: scene
  }, /*#__PURE__*/React.createElement("orthographicCamera", {
    ref: camera,
    up: [0, 1, 0]
  }), children), /*#__PURE__*/React.createElement("mesh", {
    renderOrder: 2,
    ref: plane,
    "rotation-x": -Math.PI / 2
  }, /*#__PURE__*/React.createElement("planeGeometry", null), /*#__PURE__*/React.createElement("causticsProjectionMaterial", {
    transparent: true,
    color: color,
    causticsTexture: causticsTarget.texture,
    causticsTextureB: causticsTargetB.texture,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.SrcAlphaFactor,
    depthWrite: false
  }), debug && /*#__PURE__*/React.createElement(Edges, null, /*#__PURE__*/React.createElement("lineBasicMaterial", {
    color: "#ffff00",
    toneMapped: false
  }))));
});

export { Caustics };
