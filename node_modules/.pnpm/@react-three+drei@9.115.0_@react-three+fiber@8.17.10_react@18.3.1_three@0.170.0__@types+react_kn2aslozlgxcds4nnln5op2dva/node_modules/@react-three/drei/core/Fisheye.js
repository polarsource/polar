import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { RenderCubeTexture } from './RenderCubeTexture.js';

function Fisheye({
  renderPriority = 1,
  zoom = 0,
  segments = 64,
  children,
  resolution = 896,
  ...props
}) {
  const sphere = React.useRef(null);
  const cubeApi = React.useRef(null);

  // This isn't more than a simple sphere and a fixed orthographc camera
  // pointing at it. A virtual scene is portalled into the environment map
  // of its material. The cube-camera filming that scene is being synced to
  // the portals default camera with the <UpdateCubeCamera> component.

  const {
    width,
    height
  } = useThree(state => state.size);
  const [orthoC] = React.useState(() => new THREE.OrthographicCamera());
  React.useLayoutEffect(() => {
    orthoC.position.set(0, 0, 100);
    orthoC.zoom = 100;
    orthoC.left = width / -2;
    orthoC.right = width / 2;
    orthoC.top = height / 2;
    orthoC.bottom = height / -2;
    orthoC.updateProjectionMatrix();
  }, [width, height]);
  const radius = Math.sqrt(width * width + height * height) / 100 * (0.5 + zoom / 2);
  const normal = new THREE.Vector3();
  const sph = new THREE.Sphere(new THREE.Vector3(), radius);
  const normalMatrix = new THREE.Matrix3();
  const compute = React.useCallback((event, state, prev) => {
    // Raycast from the render camera to the sphere and get the surface normal
    // of the point hit in world space of the sphere scene
    // We have to set the raycaster using the orthocam and pointer
    // to perform sphere interscetions.
    state.pointer.set(event.offsetX / state.size.width * 2 - 1, -(event.offsetY / state.size.height) * 2 + 1);
    state.raycaster.setFromCamera(state.pointer, orthoC);
    if (!state.raycaster.ray.intersectSphere(sph, normal)) return;else normal.normalize();
    // Get the matrix for transforming normals into world space
    normalMatrix.getNormalMatrix(cubeApi.current.camera.matrixWorld);
    // Get the ray
    cubeApi.current.camera.getWorldPosition(state.raycaster.ray.origin);
    state.raycaster.ray.direction.set(0, 0, 1).reflect(normal);
    state.raycaster.ray.direction.x *= -1; // flip across X to accommodate the "flip" of the env map
    state.raycaster.ray.direction.applyNormalMatrix(normalMatrix).multiplyScalar(-1);
    return undefined;
  }, []);
  useFrame(state => {
    // Take over rendering
    if (renderPriority) state.gl.render(sphere.current, orthoC);
  }, renderPriority);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("mesh", _extends({
    ref: sphere
  }, props, {
    scale: radius
  }), /*#__PURE__*/React.createElement("sphereGeometry", {
    args: [1, segments, segments]
  }), /*#__PURE__*/React.createElement("meshBasicMaterial", null, /*#__PURE__*/React.createElement(RenderCubeTexture, {
    compute: compute,
    attach: "envMap",
    flip: true,
    resolution: resolution,
    ref: cubeApi
  }, children, /*#__PURE__*/React.createElement(UpdateCubeCamera, {
    api: cubeApi
  })))));
}
function UpdateCubeCamera({
  api
}) {
  const t = new THREE.Vector3();
  const r = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const e = new THREE.Euler(0, Math.PI, 0);
  useFrame(state => {
    // Read out the cameras whereabouts, state.camera is the one *within* the portal
    state.camera.matrixWorld.decompose(t, r, s);
    // Apply its position and rotation, flip the Y axis
    api.current.camera.position.copy(t);
    api.current.camera.quaternion.setFromEuler(e).premultiply(r);
  });
  return null;
}

export { Fisheye };
