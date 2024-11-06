import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { WireframeMaterial, WireframeMaterialShaders, useWireframeUniforms, setWireframeOverride } from '../materials/WireframeMaterial.js';

function isWithGeometry(object) {
  return !!(object != null && object.geometry);
}
function isGeometry(object) {
  return !!(object != null && object.isBufferGeometry);
}
function isRefObject(object) {
  return !!(object != null && object.current);
}
function isRef(object) {
  return (object == null ? void 0 : object.current) !== undefined;
}
function isWireframeGeometry(geometry) {
  return geometry.type === 'WireframeGeometry';
}
function getUniforms() {
  const u = {};
  for (const key in WireframeMaterialShaders.uniforms) {
    u[key] = {
      value: WireframeMaterialShaders.uniforms[key]
    };
  }
  return u;
}
function getBarycentricCoordinates(geometry, removeEdge) {
  const position = geometry.getAttribute('position');
  const count = position.count;
  const barycentric = [];
  for (let i = 0; i < count; i++) {
    const even = i % 2 === 0;
    const Q = removeEdge ? 1 : 0;
    if (even) {
      barycentric.push(0, 0, 1, 0, 1, 0, 1, 0, Q);
    } else {
      barycentric.push(0, 1, 0, 0, 0, 1, 1, 0, Q);
    }
  }
  return new THREE.BufferAttribute(Float32Array.from(barycentric), 3);
}
function getInputGeometry(inputGeometry) {
  const geo = isRefObject(inputGeometry) ? inputGeometry.current : inputGeometry;
  if (!isGeometry(geo)) {
    // Disallow WireframeGeometry
    if (isWireframeGeometry(geo)) {
      throw new Error('Wireframe: WireframeGeometry is not supported.');
    }
    const parent = geo.parent;
    if (isWithGeometry(parent)) {
      // Disallow WireframeGeometry
      if (isWireframeGeometry(parent.geometry)) {
        throw new Error('Wireframe: WireframeGeometry is not supported.');
      }
      return parent.geometry;
    }
  } else {
    return geo;
  }
}
function setBarycentricCoordinates(geometry, simplify) {
  if (geometry.index) {
    console.warn('Wireframe: Requires non-indexed geometry, converting to non-indexed geometry.');
    const nonIndexedGeo = geometry.toNonIndexed();
    geometry.copy(nonIndexedGeo);
    geometry.setIndex(null);
  }
  const newBarycentric = getBarycentricCoordinates(geometry, simplify);
  geometry.setAttribute('barycentric', newBarycentric);
}
function WireframeWithCustomGeo({
  geometry: customGeometry,
  simplify = false,
  ...props
}) {
  extend({
    MeshWireframeMaterial: WireframeMaterial
  });
  const [geometry, setGeometry] = React.useState(null);
  React.useLayoutEffect(() => {
    const geom = getInputGeometry(customGeometry);
    if (!geom) {
      throw new Error('Wireframe: geometry prop must be a BufferGeometry or a ref to a BufferGeometry.');
    }
    setBarycentricCoordinates(geom, simplify);
    if (isRef(customGeometry)) {
      setGeometry(geom);
    }
  }, [simplify, customGeometry]);
  const drawnGeo = isRef(customGeometry) ? geometry : customGeometry;
  return /*#__PURE__*/React.createElement(React.Fragment, null, drawnGeo && /*#__PURE__*/React.createElement("mesh", {
    geometry: drawnGeo
  }, /*#__PURE__*/React.createElement("meshWireframeMaterial", _extends({
    attach: "material",
    transparent: true,
    side: THREE.DoubleSide,
    polygonOffset: true //
    ,
    polygonOffsetFactor: -4
  }, props, {
    extensions: {
      derivatives: true,
      fragDepth: false,
      drawBuffers: false,
      shaderTextureLOD: false
    }
  }))));
}
function WireframeWithoutCustomGeo({
  simplify = false,
  ...props
}) {
  const objectRef = React.useRef(null);
  const uniforms = React.useMemo(() => getUniforms(), [WireframeMaterialShaders.uniforms]);
  useWireframeUniforms(uniforms, props);
  React.useLayoutEffect(() => {
    const geom = getInputGeometry(objectRef);
    if (!geom) {
      throw new Error('Wireframe: Must be a child of a Mesh, Line or Points object or specify a geometry prop.');
    }
    const og = geom.clone();
    setBarycentricCoordinates(geom, simplify);
    return () => {
      geom.copy(og);
      og.dispose();
    };
  }, [simplify]);
  React.useLayoutEffect(() => {
    const parentMesh = objectRef.current.parent;
    const og = parentMesh.material.clone();
    setWireframeOverride(parentMesh.material, uniforms);
    return () => {
      parentMesh.material.dispose();
      parentMesh.material = og;
    };
  }, []);
  return /*#__PURE__*/React.createElement("object3D", {
    ref: objectRef
  });
}
function Wireframe({
  geometry: customGeometry,
  ...props
}) {
  if (customGeometry) {
    return /*#__PURE__*/React.createElement(WireframeWithCustomGeo, _extends({
      geometry: customGeometry
    }, props));
  }
  return /*#__PURE__*/React.createElement(WireframeWithoutCustomGeo, props);
}

export { Wireframe };
