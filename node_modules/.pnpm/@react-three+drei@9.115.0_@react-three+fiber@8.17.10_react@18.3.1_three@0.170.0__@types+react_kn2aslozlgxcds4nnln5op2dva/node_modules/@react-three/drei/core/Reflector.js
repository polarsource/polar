import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Plane, Vector3, Matrix4, Vector4, PerspectiveCamera, WebGLRenderTarget, DepthTexture, DepthFormat, UnsignedShortType, HalfFloatType, LinearFilter } from 'three';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { BlurPass } from '../materials/BlurPass.js';
import { MeshReflectorMaterial } from '../materials/MeshReflectorMaterial.js';

/**
 * @deprecated Use MeshReflectorMaterial instead
 */
const Reflector = /* @__PURE__ */React.forwardRef(({
  mixBlur = 0,
  mixStrength = 0.5,
  resolution = 256,
  blur = [0, 0],
  args = [1, 1],
  minDepthThreshold = 0.9,
  maxDepthThreshold = 1,
  depthScale = 0,
  depthToBlurRatioBias = 0.25,
  mirror = 0,
  children,
  debug = 0,
  distortion = 1,
  mixContrast = 1,
  distortionMap,
  ...props
}, ref) => {
  extend({
    MeshReflectorMaterial
  });
  React.useEffect(() => {
    console.warn('Reflector has been deprecated and will be removed next major. Replace it with <MeshReflectorMaterial />!');
  }, []);
  const gl = useThree(({
    gl
  }) => gl);
  const camera = useThree(({
    camera
  }) => camera);
  const scene = useThree(({
    scene
  }) => scene);
  blur = Array.isArray(blur) ? blur : [blur, blur];
  const hasBlur = blur[0] + blur[1] > 0;
  const meshRef = React.useRef(null);
  React.useImperativeHandle(ref, () => meshRef.current, []);
  const [reflectorPlane] = React.useState(() => new Plane());
  const [normal] = React.useState(() => new Vector3());
  const [reflectorWorldPosition] = React.useState(() => new Vector3());
  const [cameraWorldPosition] = React.useState(() => new Vector3());
  const [rotationMatrix] = React.useState(() => new Matrix4());
  const [lookAtPosition] = React.useState(() => new Vector3(0, 0, -1));
  const [clipPlane] = React.useState(() => new Vector4());
  const [view] = React.useState(() => new Vector3());
  const [target] = React.useState(() => new Vector3());
  const [q] = React.useState(() => new Vector4());
  const [textureMatrix] = React.useState(() => new Matrix4());
  const [virtualCamera] = React.useState(() => new PerspectiveCamera());
  const beforeRender = React.useCallback(() => {
    reflectorWorldPosition.setFromMatrixPosition(meshRef.current.matrixWorld);
    cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    rotationMatrix.extractRotation(meshRef.current.matrixWorld);
    normal.set(0, 0, 1);
    normal.applyMatrix4(rotationMatrix);
    view.subVectors(reflectorWorldPosition, cameraWorldPosition);
    // Avoid rendering when reflector is facing away
    if (view.dot(normal) > 0) return;
    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);
    rotationMatrix.extractRotation(camera.matrixWorld);
    lookAtPosition.set(0, 0, -1);
    lookAtPosition.applyMatrix4(rotationMatrix);
    lookAtPosition.add(cameraWorldPosition);
    target.subVectors(reflectorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(reflectorWorldPosition);
    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0);
    virtualCamera.up.applyMatrix4(rotationMatrix);
    virtualCamera.up.reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.far = camera.far; // Used in WebGLBackground
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
    // Update the texture matrix
    textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
    textureMatrix.multiply(virtualCamera.projectionMatrix);
    textureMatrix.multiply(virtualCamera.matrixWorldInverse);
    textureMatrix.multiply(meshRef.current.matrixWorld);
    // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
    // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
    clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);
    const projectionMatrix = virtualCamera.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
    // Calculate the scaled plane vector
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
    // Replacing the third row of the projection matrix
    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;
    projectionMatrix.elements[10] = clipPlane.z + 1.0;
    projectionMatrix.elements[14] = clipPlane.w;
  }, []);
  const [fbo1, fbo2, blurpass, reflectorProps] = React.useMemo(() => {
    const parameters = {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter
    };
    const fbo1 = new WebGLRenderTarget(resolution, resolution, parameters);
    fbo1.depthBuffer = true;
    fbo1.depthTexture = new DepthTexture(resolution, resolution);
    fbo1.depthTexture.format = DepthFormat;
    fbo1.depthTexture.type = UnsignedShortType;
    const fbo2 = new WebGLRenderTarget(resolution, resolution, parameters);
    const blurpass = new BlurPass({
      gl,
      resolution,
      width: blur[0],
      height: blur[1],
      minDepthThreshold,
      maxDepthThreshold,
      depthScale,
      depthToBlurRatioBias
    });
    const reflectorProps = {
      mirror,
      textureMatrix,
      mixBlur,
      tDiffuse: fbo1.texture,
      tDepth: fbo1.depthTexture,
      tDiffuseBlur: fbo2.texture,
      hasBlur,
      mixStrength,
      minDepthThreshold,
      maxDepthThreshold,
      depthScale,
      depthToBlurRatioBias,
      transparent: true,
      debug,
      distortion,
      distortionMap,
      mixContrast,
      'defines-USE_BLUR': hasBlur ? '' : undefined,
      'defines-USE_DEPTH': depthScale > 0 ? '' : undefined,
      'defines-USE_DISTORTION': distortionMap ? '' : undefined
    };
    return [fbo1, fbo2, blurpass, reflectorProps];
  }, [gl, blur, textureMatrix, resolution, mirror, hasBlur, mixBlur, mixStrength, minDepthThreshold, maxDepthThreshold, depthScale, depthToBlurRatioBias, debug, distortion, distortionMap, mixContrast]);
  useFrame(() => {
    if (!(meshRef != null && meshRef.current)) return;
    meshRef.current.visible = false;
    const currentXrEnabled = gl.xr.enabled;
    const currentShadowAutoUpdate = gl.shadowMap.autoUpdate;
    beforeRender();
    gl.xr.enabled = false;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(fbo1);
    gl.state.buffers.depth.setMask(true);
    if (!gl.autoClear) gl.clear();
    gl.render(scene, virtualCamera);
    if (hasBlur) blurpass.render(gl, fbo1, fbo2);
    gl.xr.enabled = currentXrEnabled;
    gl.shadowMap.autoUpdate = currentShadowAutoUpdate;
    meshRef.current.visible = true;
    gl.setRenderTarget(null);
  });
  return /*#__PURE__*/React.createElement("mesh", _extends({
    ref: meshRef
  }, props), /*#__PURE__*/React.createElement("planeGeometry", {
    args: args
  }), children ? children('meshReflectorMaterial', reflectorProps) : /*#__PURE__*/React.createElement("meshReflectorMaterial", reflectorProps));
});

export { Reflector };
