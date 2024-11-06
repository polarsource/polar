import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Color, DoubleSide } from 'three';

const Shadow = /* @__PURE__ */React.forwardRef(({
  fog = false,
  renderOrder,
  depthWrite = false,
  colorStop = 0.0,
  color = 'black',
  opacity = 0.5,
  ...props
}, ref) => {
  const canvas = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
    gradient.addColorStop(colorStop, new Color(color).getStyle());
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }, [color, colorStop]);
  return /*#__PURE__*/React.createElement("mesh", _extends({
    renderOrder: renderOrder,
    ref: ref,
    "rotation-x": -Math.PI / 2
  }, props), /*#__PURE__*/React.createElement("planeGeometry", null), /*#__PURE__*/React.createElement("meshBasicMaterial", {
    transparent: true,
    opacity: opacity,
    fog: fog,
    depthWrite: depthWrite,
    side: DoubleSide
  }, /*#__PURE__*/React.createElement("canvasTexture", {
    attach: "map",
    args: [canvas]
  })));
});

export { Shadow };
