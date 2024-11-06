import _extends from '@babel/runtime/helpers/esm/extends';
import { Box3, Vector3, Sphere } from 'three';
import * as React from 'react';

const Center = /* @__PURE__ */React.forwardRef(function Center({
  children,
  disable,
  disableX,
  disableY,
  disableZ,
  left,
  right,
  top,
  bottom,
  front,
  back,
  onCentered,
  precise = true,
  cacheKey = 0,
  ...props
}, fRef) {
  const ref = React.useRef(null);
  const outer = React.useRef(null);
  const inner = React.useRef(null);
  React.useLayoutEffect(() => {
    outer.current.matrixWorld.identity();
    const box3 = new Box3().setFromObject(inner.current, precise);
    const center = new Vector3();
    const sphere = new Sphere();
    const width = box3.max.x - box3.min.x;
    const height = box3.max.y - box3.min.y;
    const depth = box3.max.z - box3.min.z;
    box3.getCenter(center);
    box3.getBoundingSphere(sphere);
    const vAlign = top ? height / 2 : bottom ? -height / 2 : 0;
    const hAlign = left ? -width / 2 : right ? width / 2 : 0;
    const dAlign = front ? depth / 2 : back ? -depth / 2 : 0;
    outer.current.position.set(disable || disableX ? 0 : -center.x + hAlign, disable || disableY ? 0 : -center.y + vAlign, disable || disableZ ? 0 : -center.z + dAlign);

    // Only fire onCentered if the bounding box has changed
    if (typeof onCentered !== 'undefined') {
      onCentered({
        parent: ref.current.parent,
        container: ref.current,
        width,
        height,
        depth,
        boundingBox: box3,
        boundingSphere: sphere,
        center: center,
        verticalAlignment: vAlign,
        horizontalAlignment: hAlign,
        depthAlignment: dAlign
      });
    }
  }, [cacheKey, onCentered, top, left, front, disable, disableX, disableY, disableZ, precise, right, bottom, back]);
  React.useImperativeHandle(fRef, () => ref.current, []);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, props), /*#__PURE__*/React.createElement("group", {
    ref: outer
  }, /*#__PURE__*/React.createElement("group", {
    ref: inner
  }, children)));
});

export { Center };
