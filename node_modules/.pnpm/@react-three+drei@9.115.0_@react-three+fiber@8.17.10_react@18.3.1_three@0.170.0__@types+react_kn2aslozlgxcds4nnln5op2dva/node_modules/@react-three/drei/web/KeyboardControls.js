import * as React from 'react';
import create from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// These are removed in Zustand v4
// unknown

// Zustand v3 marked deprecations in 3.x, but there's no visible upgrade path

const context = /* @__PURE__ */React.createContext(null);
function KeyboardControls({
  map,
  children,
  onChange,
  domElement
}) {
  const key = map.map(item => item.name + item.keys).join('-');
  const useControls = React.useMemo(() => {
    return create(subscribeWithSelector(() => map.reduce((prev, cur) => ({
      ...prev,
      [cur.name]: false
    }), {})));
  }, [key]);
  const api = React.useMemo(() => [useControls.subscribe, useControls.getState, useControls], [key]);
  const set = useControls.setState;
  React.useEffect(() => {
    const config = map.map(({
      name,
      keys,
      up
    }) => ({
      keys,
      up,
      fn: value => {
        // Set zustand state
        set({
          [name]: value
        });
        // Inform callback
        if (onChange) onChange(name, value, api[1]());
      }
    }));
    const keyMap = config.reduce((out, {
      keys,
      fn,
      up = true
    }) => {
      keys.forEach(key => out[key] = {
        fn,
        pressed: false,
        up
      });
      return out;
    }, {});
    const downHandler = ({
      key,
      code
    }) => {
      const obj = keyMap[key] || keyMap[code];
      if (!obj) return;
      const {
        fn,
        pressed,
        up
      } = obj;
      obj.pressed = true;
      if (up || !pressed) fn(true);
    };
    const upHandler = ({
      key,
      code
    }) => {
      const obj = keyMap[key] || keyMap[code];
      if (!obj) return;
      const {
        fn,
        up
      } = obj;
      obj.pressed = false;
      if (up) fn(false);
    };
    const source = domElement || window;
    source.addEventListener('keydown', downHandler, {
      passive: true
    });
    source.addEventListener('keyup', upHandler, {
      passive: true
    });
    return () => {
      source.removeEventListener('keydown', downHandler);
      source.removeEventListener('keyup', upHandler);
    };
  }, [domElement, key]);
  return /*#__PURE__*/React.createElement(context.Provider, {
    value: api,
    children: children
  });
}
function useKeyboardControls(sel) {
  const [sub, get, store] = React.useContext(context);
  if (sel) return store(sel);else return [sub, get];
}

export { KeyboardControls, useKeyboardControls };
