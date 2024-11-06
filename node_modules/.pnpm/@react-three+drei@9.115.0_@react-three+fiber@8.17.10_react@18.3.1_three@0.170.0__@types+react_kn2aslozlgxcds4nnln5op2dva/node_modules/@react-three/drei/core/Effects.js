import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { WebGLRenderTarget, HalfFloatType, RGBAFormat, UnsignedByteType } from 'three';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { EffectComposer, RenderPass, ShaderPass, GammaCorrectionShader } from 'three-stdlib';

const isWebGL2Available = () => {
  try {
    var canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch (e) {
    return false;
  }
};
const Effects = /* @__PURE__ */React.forwardRef(({
  children,
  multisamping = 8,
  renderIndex = 1,
  disableRender,
  disableGamma,
  disableRenderPass,
  depthBuffer = true,
  stencilBuffer = false,
  anisotropy = 1,
  encoding,
  type,
  ...props
}, ref) => {
  React.useMemo(() => extend({
    EffectComposer,
    RenderPass,
    ShaderPass
  }), []);
  const composer = React.useRef(null);
  React.useImperativeHandle(ref, () => composer.current, []);
  const {
    scene,
    camera,
    gl,
    size,
    viewport
  } = useThree();
  const [target] = React.useState(() => {
    const t = new WebGLRenderTarget(size.width, size.height, {
      type: type || HalfFloatType,
      format: RGBAFormat,
      depthBuffer,
      stencilBuffer,
      anisotropy
    });

    // sRGB textures must be RGBA8 since r137 https://github.com/mrdoob/three.js/pull/23129
    if (type === UnsignedByteType && encoding != null) {
      if ('colorSpace' in t) t.texture.colorSpace = encoding;else t.texture.encoding = encoding;
    }
    t.samples = multisamping;
    return t;
  });
  React.useEffect(() => {
    var _composer$current, _composer$current2;
    (_composer$current = composer.current) == null || _composer$current.setSize(size.width, size.height);
    (_composer$current2 = composer.current) == null || _composer$current2.setPixelRatio(viewport.dpr);
  }, [gl, size, viewport.dpr]);
  useFrame(() => {
    var _composer$current3;
    if (!disableRender) (_composer$current3 = composer.current) == null || _composer$current3.render();
  }, renderIndex);
  const passes = [];
  if (!disableRenderPass) passes.push( /*#__PURE__*/React.createElement("renderPass", {
    key: "renderpass",
    attach: `passes-${passes.length}`,
    args: [scene, camera]
  }));
  if (!disableGamma) passes.push( /*#__PURE__*/React.createElement("shaderPass", {
    attach: `passes-${passes.length}`,
    key: "gammapass",
    args: [GammaCorrectionShader]
  }));
  React.Children.forEach(children, el => {
    el && passes.push( /*#__PURE__*/React.cloneElement(el, {
      key: passes.length,
      attach: `passes-${passes.length}`
    }));
  });
  return /*#__PURE__*/React.createElement("effectComposer", _extends({
    ref: composer,
    args: [gl, target]
  }, props), passes);
});

export { Effects, isWebGL2Available };
