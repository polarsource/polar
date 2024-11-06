import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { useThree, useFrame, context as context$1 } from '@react-three/fiber';
import { easing } from 'maath';

const context = /* @__PURE__ */React.createContext(null);
function useScroll() {
  return React.useContext(context);
}
function ScrollControls({
  eps = 0.00001,
  enabled = true,
  infinite,
  horizontal,
  pages = 1,
  distance = 1,
  damping = 0.25,
  maxSpeed = Infinity,
  prepend = false,
  style = {},
  children
}) {
  const {
    get,
    setEvents,
    gl,
    size,
    invalidate,
    events
  } = useThree();
  const [el] = React.useState(() => document.createElement('div'));
  const [fill] = React.useState(() => document.createElement('div'));
  const [fixed] = React.useState(() => document.createElement('div'));
  const target = gl.domElement.parentNode;
  const scroll = React.useRef(0);
  const state = React.useMemo(() => {
    const state = {
      el,
      eps,
      fill,
      fixed,
      horizontal,
      damping,
      offset: 0,
      delta: 0,
      scroll,
      pages,
      // 0-1 for a range between from -> from + distance
      range(from, distance, margin = 0) {
        const start = from - margin;
        const end = start + distance + margin * 2;
        return this.offset < start ? 0 : this.offset > end ? 1 : (this.offset - start) / (end - start);
      },
      // 0-1-0 for a range between from -> from + distance
      curve(from, distance, margin = 0) {
        return Math.sin(this.range(from, distance, margin) * Math.PI);
      },
      // true/false for a range between from -> from + distance
      visible(from, distance, margin = 0) {
        const start = from - margin;
        const end = start + distance + margin * 2;
        return this.offset >= start && this.offset <= end;
      }
    };
    return state;
  }, [eps, damping, horizontal, pages]);
  React.useEffect(() => {
    el.style.position = 'absolute';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style[horizontal ? 'overflowX' : 'overflowY'] = 'auto';
    el.style[horizontal ? 'overflowY' : 'overflowX'] = 'hidden';
    el.style.top = '0px';
    el.style.left = '0px';
    for (const key in style) {
      el.style[key] = style[key];
    }
    fixed.style.position = 'sticky';
    fixed.style.top = '0px';
    fixed.style.left = '0px';
    fixed.style.width = '100%';
    fixed.style.height = '100%';
    fixed.style.overflow = 'hidden';
    el.appendChild(fixed);
    fill.style.height = horizontal ? '100%' : `${pages * distance * 100}%`;
    fill.style.width = horizontal ? `${pages * distance * 100}%` : '100%';
    fill.style.pointerEvents = 'none';
    el.appendChild(fill);
    if (prepend) target.prepend(el);else target.appendChild(el);

    // Init scroll one pixel in to allow upward/leftward scroll
    el[horizontal ? 'scrollLeft' : 'scrollTop'] = 1;
    const oldTarget = events.connected || gl.domElement;
    requestAnimationFrame(() => events.connect == null ? void 0 : events.connect(el));
    const oldCompute = get().events.compute;
    setEvents({
      compute(event, state) {
        // we are using boundingClientRect because we could not rely on target.offsetTop as canvas could be positioned anywhere in dom
        const {
          left,
          top
        } = target.getBoundingClientRect();
        const offsetX = event.clientX - left;
        const offsetY = event.clientY - top;
        state.pointer.set(offsetX / state.size.width * 2 - 1, -(offsetY / state.size.height) * 2 + 1);
        state.raycaster.setFromCamera(state.pointer, state.camera);
      }
    });
    return () => {
      target.removeChild(el);
      setEvents({
        compute: oldCompute
      });
      events.connect == null || events.connect(oldTarget);
    };
  }, [pages, distance, horizontal, el, fill, fixed, target]);
  React.useEffect(() => {
    if (events.connected === el) {
      const containerLength = size[horizontal ? 'width' : 'height'];
      const scrollLength = el[horizontal ? 'scrollWidth' : 'scrollHeight'];
      const scrollThreshold = scrollLength - containerLength;
      let current = 0;
      let disableScroll = true;
      let firstRun = true;
      const onScroll = () => {
        // Prevent first scroll because it is indirectly caused by the one pixel offset
        if (!enabled || firstRun) return;
        invalidate();
        current = el[horizontal ? 'scrollLeft' : 'scrollTop'];
        scroll.current = current / scrollThreshold;
        if (infinite) {
          if (!disableScroll) {
            if (current >= scrollThreshold) {
              const damp = 1 - state.offset;
              el[horizontal ? 'scrollLeft' : 'scrollTop'] = 1;
              scroll.current = state.offset = -damp;
              disableScroll = true;
            } else if (current <= 0) {
              const damp = 1 + state.offset;
              el[horizontal ? 'scrollLeft' : 'scrollTop'] = scrollLength;
              scroll.current = state.offset = damp;
              disableScroll = true;
            }
          }
          if (disableScroll) setTimeout(() => disableScroll = false, 40);
        }
      };
      el.addEventListener('scroll', onScroll, {
        passive: true
      });
      requestAnimationFrame(() => firstRun = false);
      const onWheel = e => el.scrollLeft += e.deltaY / 2;
      if (horizontal) el.addEventListener('wheel', onWheel, {
        passive: true
      });
      return () => {
        el.removeEventListener('scroll', onScroll);
        if (horizontal) el.removeEventListener('wheel', onWheel);
      };
    }
  }, [el, events, size, infinite, state, invalidate, horizontal, enabled]);
  let last = 0;
  useFrame((_, delta) => {
    last = state.offset;
    easing.damp(state, 'offset', scroll.current, damping, delta, maxSpeed, undefined, eps);
    easing.damp(state, 'delta', Math.abs(last - state.offset), damping, delta, maxSpeed, undefined, eps);
    if (state.delta > eps) invalidate();
  });
  return /*#__PURE__*/React.createElement(context.Provider, {
    value: state
  }, children);
}
const ScrollCanvas = /* @__PURE__ */React.forwardRef(({
  children
}, ref) => {
  const group = React.useRef(null);
  React.useImperativeHandle(ref, () => group.current, []);
  const state = useScroll();
  const {
    width,
    height
  } = useThree(state => state.viewport);
  useFrame(() => {
    group.current.position.x = state.horizontal ? -width * (state.pages - 1) * state.offset : 0;
    group.current.position.y = state.horizontal ? 0 : height * (state.pages - 1) * state.offset;
  });
  return /*#__PURE__*/React.createElement("group", {
    ref: group
  }, children);
});
const ScrollHtml = /*#__PURE__*/React.forwardRef(({
  children,
  style,
  ...props
}, ref) => {
  const state = useScroll();
  const group = React.useRef(null);
  React.useImperativeHandle(ref, () => group.current, []);
  const {
    width,
    height
  } = useThree(state => state.size);
  const fiberState = React.useContext(context$1);
  const root = React.useMemo(() => ReactDOM.createRoot(state.fixed), [state.fixed]);
  useFrame(() => {
    if (state.delta > state.eps) {
      group.current.style.transform = `translate3d(${state.horizontal ? -width * (state.pages - 1) * state.offset : 0}px,${state.horizontal ? 0 : height * (state.pages - 1) * -state.offset}px,0)`;
    }
  });
  root.render( /*#__PURE__*/React.createElement("div", _extends({
    ref: group,
    style: {
      ...style,
      position: 'absolute',
      top: 0,
      left: 0,
      willChange: 'transform'
    }
  }, props), /*#__PURE__*/React.createElement(context.Provider, {
    value: state
  }, /*#__PURE__*/React.createElement(context$1.Provider, {
    value: fiberState
  }, children))));
  return null;
});
const Scroll = /* @__PURE__ */React.forwardRef(({
  html,
  ...props
}, ref) => {
  const El = html ? ScrollHtml : ScrollCanvas;
  return /*#__PURE__*/React.createElement(El, _extends({
    ref: ref
  }, props));
});

export { Scroll, ScrollControls, useScroll };
