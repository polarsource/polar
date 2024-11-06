import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as THREE from 'three';

function create(type, effect) {
  const El = type + 'Geometry';
  return /*#__PURE__*/React.forwardRef(({
    args,
    children,
    ...props
  }, fref) => {
    const ref = React.useRef(null);
    React.useImperativeHandle(fref, () => ref.current);
    React.useLayoutEffect(() => void (effect == null ? void 0 : effect(ref.current)));
    return /*#__PURE__*/React.createElement("mesh", _extends({
      ref: ref
    }, props), /*#__PURE__*/React.createElement(El, {
      attach: "geometry",
      args: args
    }), children);
  });
}
const Box = /* @__PURE__ */create('box');
const Circle = /* @__PURE__ */create('circle');
const Cone = /* @__PURE__ */create('cone');
const Cylinder = /* @__PURE__ */create('cylinder');
const Sphere = /* @__PURE__ */create('sphere');
const Plane = /* @__PURE__ */create('plane');
const Tube = /* @__PURE__ */create('tube');
const Torus = /* @__PURE__ */create('torus');
const TorusKnot = /* @__PURE__ */create('torusKnot');
const Tetrahedron = /* @__PURE__ */create('tetrahedron');
const Ring = /* @__PURE__ */create('ring');
const Polyhedron = /* @__PURE__ */create('polyhedron');
const Icosahedron = /* @__PURE__ */create('icosahedron');
const Octahedron = /* @__PURE__ */create('octahedron');
const Dodecahedron = /* @__PURE__ */create('dodecahedron');
const Extrude = /* @__PURE__ */create('extrude');
const Lathe = /* @__PURE__ */create('lathe');
const Capsule = /* @__PURE__ */create('capsule');
const Shape = /* @__PURE__ */create('shape', ({
  geometry
}) => {
  // Calculate UVs (by https://discourse.threejs.org/u/prisoner849)
  // https://discourse.threejs.org/t/custom-shape-in-image-not-working/49348/10
  const pos = geometry.attributes.position;
  const b3 = new THREE.Box3().setFromBufferAttribute(pos);
  const b3size = new THREE.Vector3();
  b3.getSize(b3size);
  const uv = [];
  let x = 0,
    y = 0,
    u = 0,
    v = 0;
  for (let i = 0; i < pos.count; i++) {
    x = pos.getX(i);
    y = pos.getY(i);
    u = (x - b3.min.x) / b3size.x;
    v = (y - b3.min.y) / b3size.y;
    uv.push(u, v);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
});

export { Box, Capsule, Circle, Cone, Cylinder, Dodecahedron, Extrude, Icosahedron, Lathe, Octahedron, Plane, Polyhedron, Ring, Shape, Sphere, Tetrahedron, Torus, TorusKnot, Tube };
