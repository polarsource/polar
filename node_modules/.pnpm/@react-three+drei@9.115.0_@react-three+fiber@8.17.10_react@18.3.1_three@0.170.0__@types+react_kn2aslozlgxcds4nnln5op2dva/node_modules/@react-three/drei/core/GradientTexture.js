import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

let GradientType = /*#__PURE__*/function (GradientType) {
  GradientType["Linear"] = "linear";
  GradientType["Radial"] = "radial";
  return GradientType;
}({});
function GradientTexture({
  stops,
  colors,
  size = 1024,
  width = 16,
  type = GradientType.Linear,
  innerCircleRadius = 0,
  outerCircleRadius = 'auto',
  ...props
}) {
  const gl = useThree(state => state.gl);
  const canvas = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = size;
    let gradient;
    if (type === GradientType.Linear) {
      gradient = context.createLinearGradient(0, 0, 0, size);
    } else {
      const canvasCenterX = canvas.width / 2;
      const canvasCenterY = canvas.height / 2;
      const radius = outerCircleRadius !== 'auto' ? Math.abs(Number(outerCircleRadius)) : Math.sqrt(canvasCenterX ** 2 + canvasCenterY ** 2);
      gradient = context.createRadialGradient(canvasCenterX, canvasCenterY, Math.abs(innerCircleRadius), canvasCenterX, canvasCenterY, radius);
    }
    const tempColor = new THREE.Color(); // reuse instance for performance
    let i = stops.length;
    while (i--) {
      gradient.addColorStop(stops[i], tempColor.set(colors[i]).getStyle());
    }
    context.save();
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, size);
    context.restore();
    return canvas;
  }, [stops]);

  // @ts-ignore ????
  return /*#__PURE__*/React.createElement("canvasTexture", _extends({
    colorSpace: gl.outputColorSpace,
    args: [canvas],
    attach: "map"
  }, props));
}

export { GradientTexture, GradientType };
