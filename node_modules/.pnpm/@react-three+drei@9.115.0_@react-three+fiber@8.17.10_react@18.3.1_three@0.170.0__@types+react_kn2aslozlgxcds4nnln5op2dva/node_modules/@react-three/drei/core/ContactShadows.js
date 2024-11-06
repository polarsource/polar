import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { HorizontalBlurShader, VerticalBlurShader } from 'three-stdlib';

const ContactShadows = /* @__PURE__ */React.forwardRef(({
  scale = 10,
  frames = Infinity,
  opacity = 1,
  width = 1,
  height = 1,
  blur = 1,
  near = 0,
  far = 10,
  resolution = 512,
  smooth = true,
  color = '#000000',
  depthWrite = false,
  renderOrder,
  ...props
}, fref) => {
  const ref = React.useRef(null);
  const scene = useThree(state => state.scene);
  const gl = useThree(state => state.gl);
  const shadowCamera = React.useRef(null);
  width = width * (Array.isArray(scale) ? scale[0] : scale || 1);
  height = height * (Array.isArray(scale) ? scale[1] : scale || 1);
  const [renderTarget, planeGeometry, depthMaterial, blurPlane, horizontalBlurMaterial, verticalBlurMaterial, renderTargetBlur] = React.useMemo(() => {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution);
    const renderTargetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    renderTargetBlur.texture.generateMipmaps = renderTarget.texture.generateMipmaps = false;
    const planeGeometry = new THREE.PlaneGeometry(width, height).rotateX(Math.PI / 2);
    const blurPlane = new THREE.Mesh(planeGeometry);
    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.depthTest = depthMaterial.depthWrite = false;
    depthMaterial.onBeforeCompile = shader => {
      shader.uniforms = {
        ...shader.uniforms,
        ucolor: {
          value: new THREE.Color(color)
        }
      };
      shader.fragmentShader = shader.fragmentShader.replace(`void main() {`,
      //
      `uniform vec3 ucolor;
           void main() {
          `);
      shader.fragmentShader = shader.fragmentShader.replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      // Colorize the shadow, multiply by the falloff so that the center can remain darker
      'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );');
    };
    const horizontalBlurMaterial = new THREE.ShaderMaterial(HorizontalBlurShader);
    const verticalBlurMaterial = new THREE.ShaderMaterial(VerticalBlurShader);
    verticalBlurMaterial.depthTest = horizontalBlurMaterial.depthTest = false;
    return [renderTarget, planeGeometry, depthMaterial, blurPlane, horizontalBlurMaterial, verticalBlurMaterial, renderTargetBlur];
  }, [resolution, width, height, scale, color]);
  const blurShadows = blur => {
    blurPlane.visible = true;
    blurPlane.material = horizontalBlurMaterial;
    horizontalBlurMaterial.uniforms.tDiffuse.value = renderTarget.texture;
    horizontalBlurMaterial.uniforms.h.value = blur * 1 / 256;
    gl.setRenderTarget(renderTargetBlur);
    gl.render(blurPlane, shadowCamera.current);
    blurPlane.material = verticalBlurMaterial;
    verticalBlurMaterial.uniforms.tDiffuse.value = renderTargetBlur.texture;
    verticalBlurMaterial.uniforms.v.value = blur * 1 / 256;
    gl.setRenderTarget(renderTarget);
    gl.render(blurPlane, shadowCamera.current);
    blurPlane.visible = false;
  };
  let count = 0;
  let initialBackground;
  let initialOverrideMaterial;
  useFrame(() => {
    if (shadowCamera.current && (frames === Infinity || count < frames)) {
      count++;
      initialBackground = scene.background;
      initialOverrideMaterial = scene.overrideMaterial;
      ref.current.visible = false;
      scene.background = null;
      scene.overrideMaterial = depthMaterial;
      gl.setRenderTarget(renderTarget);
      gl.render(scene, shadowCamera.current);
      blurShadows(blur);
      if (smooth) blurShadows(blur * 0.4);
      gl.setRenderTarget(null);
      ref.current.visible = true;
      scene.overrideMaterial = initialOverrideMaterial;
      scene.background = initialBackground;
    }
  });
  React.useImperativeHandle(fref, () => ref.current, []);
  return /*#__PURE__*/React.createElement("group", _extends({
    "rotation-x": Math.PI / 2
  }, props, {
    ref: ref
  }), /*#__PURE__*/React.createElement("mesh", {
    renderOrder: renderOrder,
    geometry: planeGeometry,
    scale: [1, -1, 1],
    rotation: [-Math.PI / 2, 0, 0]
  }, /*#__PURE__*/React.createElement("meshBasicMaterial", {
    transparent: true,
    map: renderTarget.texture,
    opacity: opacity,
    depthWrite: depthWrite
  })), /*#__PURE__*/React.createElement("orthographicCamera", {
    ref: shadowCamera,
    args: [-width / 2, width / 2, height / 2, -height / 2, near, far]
  }));
});

export { ContactShadows };
