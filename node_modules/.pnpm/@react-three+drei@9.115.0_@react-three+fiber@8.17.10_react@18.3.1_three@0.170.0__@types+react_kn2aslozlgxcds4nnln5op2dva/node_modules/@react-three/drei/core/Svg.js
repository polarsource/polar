import _extends from '@babel/runtime/helpers/esm/extends';
import { useLoader } from '@react-three/fiber';
import * as React from 'react';
import { forwardRef, useMemo, useEffect, Fragment } from 'react';
import { DoubleSide } from 'three';
import { SVGLoader } from 'three-stdlib';

const Svg = /* @__PURE__ */forwardRef(function R3FSvg({
  src,
  skipFill,
  skipStrokes,
  fillMaterial,
  strokeMaterial,
  fillMeshProps,
  strokeMeshProps,
  ...props
}, ref) {
  const svg = useLoader(SVGLoader, !src.startsWith('<svg') ? src : `data:image/svg+xml;utf8,${src}`);
  const strokeGeometries = useMemo(() => skipStrokes ? [] : svg.paths.map(path => {
    var _path$userData;
    return ((_path$userData = path.userData) == null ? void 0 : _path$userData.style.stroke) === undefined || path.userData.style.stroke === 'none' ? null : path.subPaths.map(subPath => SVGLoader.pointsToStroke(subPath.getPoints(), path.userData.style));
  }), [svg, skipStrokes]);
  useEffect(() => {
    return () => strokeGeometries.forEach(group => group && group.map(g => g.dispose()));
  }, [strokeGeometries]);
  let renderOrder = 0;
  return /*#__PURE__*/React.createElement("object3D", _extends({
    ref: ref
  }, props), /*#__PURE__*/React.createElement("object3D", {
    scale: [1, -1, 1]
  }, svg.paths.map((path, p) => {
    var _path$userData2, _path$userData3;
    return /*#__PURE__*/React.createElement(Fragment, {
      key: p
    }, !skipFill && ((_path$userData2 = path.userData) == null ? void 0 : _path$userData2.style.fill) !== undefined && path.userData.style.fill !== 'none' && SVGLoader.createShapes(path).map((shape, s) => /*#__PURE__*/React.createElement("mesh", _extends({
      key: s
    }, fillMeshProps, {
      renderOrder: renderOrder++
    }), /*#__PURE__*/React.createElement("shapeGeometry", {
      args: [shape]
    }), /*#__PURE__*/React.createElement("meshBasicMaterial", _extends({
      color: path.userData.style.fill,
      opacity: path.userData.style.fillOpacity,
      transparent: true,
      side: DoubleSide,
      depthWrite: false
    }, fillMaterial)))), !skipStrokes && ((_path$userData3 = path.userData) == null ? void 0 : _path$userData3.style.stroke) !== undefined && path.userData.style.stroke !== 'none' && path.subPaths.map((_subPath, s) => /*#__PURE__*/React.createElement("mesh", _extends({
      key: s,
      geometry: strokeGeometries[p][s]
    }, strokeMeshProps, {
      renderOrder: renderOrder++
    }), /*#__PURE__*/React.createElement("meshBasicMaterial", _extends({
      color: path.userData.style.stroke,
      opacity: path.userData.style.strokeOpacity,
      transparent: true,
      side: DoubleSide,
      depthWrite: false
    }, strokeMaterial)))));
  })));
});

export { Svg };
