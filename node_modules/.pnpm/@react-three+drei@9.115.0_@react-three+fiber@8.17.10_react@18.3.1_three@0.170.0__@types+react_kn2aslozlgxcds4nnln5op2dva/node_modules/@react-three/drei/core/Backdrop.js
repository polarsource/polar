import * as React from 'react';

const easeInExpo = x => x === 0 ? 0 : Math.pow(2, 10 * x - 10);
function Backdrop({
  children,
  floor = 0.25,
  segments = 20,
  receiveShadow,
  ...props
}) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    let i = 0;
    const offset = segments / segments / 2;
    const position = ref.current.attributes.position;
    for (let x = 0; x < segments + 1; x++) {
      for (let y = 0; y < segments + 1; y++) {
        position.setXYZ(i++, x / segments - offset + (x === 0 ? -floor : 0), y / segments - offset, easeInExpo(x / segments));
      }
    }
    position.needsUpdate = true;
    ref.current.computeVertexNormals();
  }, [segments, floor]);
  return /*#__PURE__*/React.createElement("group", props, /*#__PURE__*/React.createElement("mesh", {
    receiveShadow: receiveShadow,
    rotation: [-Math.PI / 2, 0, Math.PI / 2]
  }, /*#__PURE__*/React.createElement("planeGeometry", {
    ref: ref,
    args: [1, 1, segments, segments]
  }), children));
}

export { Backdrop };
